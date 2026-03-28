import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { InterviewSession } from "../models/InterviewSession";
import { streamChat } from "../services/aiService";

// Helper to collect full AI response from stream
async function collectStreamResponse(response: Response): Promise<string> {
  const reader = (response as any).body?.getReader?.();
  if (!reader) {
    const text = await (response as any).text();
    // Try to parse SSE format
    const lines = text.split("\n");
    let result = "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") break;
        try {
          const parsed = JSON.parse(data);
          result += parsed.token || parsed.text || parsed.content || "";
        } catch {
          result += data;
        }
      }
    }
    return result || text;
  }

  const decoder = new TextDecoder();
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          result += parsed.token || parsed.text || parsed.content || "";
        } catch {
          result += data;
        }
      }
    }
  }
  return result;
}

// Helper to call AI and get text response
async function askAI(
  systemPrompt: string,
  userMessage: string,
  model: string
): Promise<string> {
  const response = await streamChat({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    model,
    systemPrompt,
  });
  return collectStreamResponse(response as any);
}

// POST /api/interview/start
export async function startInterview(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const { language, topic, difficulty, questionCount, interviewType, resumeText, model } =
      req.body;

    if (!language || !topic || !difficulty || !questionCount) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    let systemPrompt = "";
    let userPrompt = "";

    if (interviewType === "hr") {
      systemPrompt = `You are an expert HR interviewer at a top tech company. Generate realistic HR/behavioral interview questions that assess soft skills, cultural fit, and behavioral competencies.`;
      userPrompt = `Generate exactly ${questionCount} HR/behavioral interview questions for a ${difficulty} level interview. Focus on topics like teamwork, leadership, conflict resolution, problem-solving, and adaptability.

Return ONLY a JSON array of strings, each being one question. No other text.
Example: ["Tell me about a time...", "How do you handle..."]`;
    } else if (interviewType === "resume") {
      systemPrompt = `You are an expert technical interviewer. Based on the candidate's resume, generate targeted interview questions that probe their claimed experience and skills.`;
      userPrompt = `Based on this resume, generate exactly ${questionCount} targeted interview questions at ${difficulty} difficulty level.

Resume:
${resumeText || "No resume provided"}

Return ONLY a JSON array of strings, each being one question. No other text.`;
    } else {
      systemPrompt = `You are an expert technical interviewer at a FAANG company. Generate realistic, commonly-asked interview questions for the specified programming language/subject and topic. Questions should be appropriate for the given difficulty level and test real understanding.`;
      userPrompt = `Generate exactly ${questionCount} technical interview questions for:
- Subject: ${language}
- Topic: ${topic}
- Difficulty: ${difficulty}

Questions should be realistic FAANG-level interview questions. Mix conceptual, problem-solving, and scenario-based questions.

Return ONLY a JSON array of strings, each being one question. No other text.
Example: ["Explain the difference between...", "How would you implement...", "What is the time complexity of..."]`;
    }

    const aiModel = model || "groq-llama3-70b";
    const aiResponse = await askAI(systemPrompt, userPrompt, aiModel);

    // Parse questions from AI response
    let questions: string[] = [];
    try {
      // Try to extract JSON array from response
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Fallback: split by numbered lines
      questions = aiResponse
        .split(/\n/)
        .filter((line) => line.trim())
        .map((line) => line.replace(/^\d+[\.\)]\s*/, "").trim())
        .filter((q) => q.length > 10);
    }

    if (questions.length === 0) {
      // Fallback questions
      questions = Array.from(
        { length: questionCount },
        (_, i) => `Question ${i + 1}: Explain a key concept related to ${topic} in ${language}.`
      );
    }

    // Trim to requested count
    questions = questions.slice(0, questionCount);

    // Create session
    const session = await InterviewSession.create({
      userId,
      language,
      topic,
      difficulty,
      questionCount: questions.length,
      interviewType: interviewType || "technical",
      resumeText,
      model: aiModel,
      status: "active",
      questions: questions.map((q) => ({
        question: q,
        userAnswer: "",
        score: 0,
        feedback: "",
        technicalAccuracy: 0,
        clarity: 0,
        communication: 0,
        timeSpent: 0,
      })),
    });

    res.json({
      sessionId: session._id,
      questions: questions.map((q, i) => ({ index: i, question: q })),
      status: "active",
    });
  } catch (error: any) {
    console.error("[Interview] Start error:", error.message);
    res.status(500).json({ error: "Failed to start interview" });
  }
}

// POST /api/interview/evaluate
export async function evaluateAnswer(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const { sessionId, questionIndex, userAnswer, timeSpent, emotionSnapshots } = req.body;

    const session = await InterviewSession.findOne({ _id: sessionId, userId });
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    if (questionIndex < 0 || questionIndex >= session.questions.length) {
      res.status(400).json({ error: "Invalid question index" });
      return;
    }

    const question = session.questions[questionIndex];

    const systemPrompt = `You are an expert interview evaluator. Evaluate the candidate's answer to a technical interview question. Be fair but rigorous. Provide actionable feedback.

You MUST respond with ONLY valid JSON in this exact format:
{
  "score": <number 0-10>,
  "technicalAccuracy": <number 0-10>,
  "clarity": <number 0-10>,
  "communication": <number 0-10>,
  "feedback": "<string with what was good and what to improve>"
}`;

    const userPrompt = `Interview Context:
- Subject: ${session.language}
- Topic: ${session.topic}
- Difficulty: ${session.difficulty}
- Type: ${session.interviewType}

Question: ${question.question}

Candidate's Answer: ${userAnswer || "(No answer provided)"}

Time taken: ${timeSpent || 0} seconds

Evaluate this answer and return JSON.`;

    const aiResponse = await askAI(systemPrompt, userPrompt, session.model);

    let evaluation = {
      score: 0,
      technicalAccuracy: 0,
      clarity: 0,
      communication: 0,
      feedback: "Could not evaluate answer.",
    };

    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        evaluation = {
          score: Math.min(10, Math.max(0, Number(parsed.score) || 0)),
          technicalAccuracy: Math.min(10, Math.max(0, Number(parsed.technicalAccuracy) || 0)),
          clarity: Math.min(10, Math.max(0, Number(parsed.clarity) || 0)),
          communication: Math.min(10, Math.max(0, Number(parsed.communication) || 0)),
          feedback: parsed.feedback || "No feedback available.",
        };
      }
    } catch {
      evaluation.feedback = aiResponse || "Evaluation failed.";
    }

    // Update session
    session.questions[questionIndex].userAnswer = userAnswer || "";
    session.questions[questionIndex].score = evaluation.score;
    session.questions[questionIndex].feedback = evaluation.feedback;
    session.questions[questionIndex].technicalAccuracy = evaluation.technicalAccuracy;
    session.questions[questionIndex].clarity = evaluation.clarity;
    session.questions[questionIndex].communication = evaluation.communication;
    session.questions[questionIndex].timeSpent = timeSpent || 0;

    // Store emotion snapshots
    if (emotionSnapshots && Array.isArray(emotionSnapshots)) {
      session.emotionSnapshots.push(...emotionSnapshots);
    }

    await session.save();

    res.json({
      questionIndex,
      evaluation,
    });
  } catch (error: any) {
    console.error("[Interview] Evaluate error:", error.message);
    res.status(500).json({ error: "Failed to evaluate answer" });
  }
}

// POST /api/interview/complete
export async function completeInterview(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const { sessionId, emotionSnapshots } = req.body;

    const session = await InterviewSession.findOne({ _id: sessionId, userId });
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    // Store final emotion snapshots
    if (emotionSnapshots && Array.isArray(emotionSnapshots)) {
      session.emotionSnapshots.push(...emotionSnapshots);
    }

    // Calculate overall score
    const answeredQuestions = session.questions.filter((q) => q.userAnswer);
    const totalScore = answeredQuestions.reduce((sum, q) => sum + q.score, 0);
    session.overallScore =
      answeredQuestions.length > 0 ? Math.round((totalScore / answeredQuestions.length) * 10) / 10 : 0;

    // Calculate behavioral analysis from emotion snapshots
    const snapshots = session.emotionSnapshots;
    if (snapshots.length > 0) {
      const avgConfidence =
        snapshots.reduce((s, e) => s + e.confidence, 0) / snapshots.length;
      const avgNeutral =
        snapshots.reduce((s, e) => s + e.neutral, 0) / snapshots.length;
      const avgHappy =
        snapshots.reduce((s, e) => s + e.happy, 0) / snapshots.length;
      const avgFearful =
        snapshots.reduce((s, e) => s + e.fearful, 0) / snapshots.length;
      const avgSad =
        snapshots.reduce((s, e) => s + e.sad, 0) / snapshots.length;

      session.behavioralAnalysis = {
        confidence: Math.round(avgConfidence * 100) / 10,
        eyeContact: Math.round((avgNeutral + avgHappy) * 50) / 10,
        composure: Math.round((1 - avgFearful - avgSad) * 100) / 10,
        hesitation: Math.round(avgFearful * 100) / 10,
      };
    }

    // Generate final report via AI
    const questionsReport = session.questions
      .map(
        (q, i) =>
          `Q${i + 1}: ${q.question}\nAnswer: ${q.userAnswer || "(skipped)"}\nScore: ${q.score}/10\nFeedback: ${q.feedback}`
      )
      .join("\n\n");

    const systemPrompt = `You are an expert career coach. Generate a comprehensive interview performance report. Be encouraging but honest. Structure it clearly.`;

    const userPrompt = `Generate a final interview report for:
- Subject: ${session.language}
- Topic: ${session.topic}
- Difficulty: ${session.difficulty}
- Overall Score: ${session.overallScore}/10
- Behavioral Metrics: Confidence ${session.behavioralAnalysis.confidence}/10, Eye Contact ${session.behavioralAnalysis.eyeContact}/10, Composure ${session.behavioralAnalysis.composure}/10

Question-by-Question Results:
${questionsReport}

Provide:
1. Overall Performance Summary
2. Strengths
3. Areas for Improvement
4. Topic-wise Analysis
5. Communication & Behavioral Feedback
6. Specific Suggestions for Improvement
7. Recommended Study Resources`;

    const reportText = await askAI(systemPrompt, userPrompt, session.model);
    session.finalReport = reportText;
    session.status = "completed";

    await session.save();

    res.json({
      sessionId: session._id,
      overallScore: session.overallScore,
      questions: session.questions,
      behavioralAnalysis: session.behavioralAnalysis,
      finalReport: session.finalReport,
      status: "completed",
    });
  } catch (error: any) {
    console.error("[Interview] Complete error:", error.message);
    res.status(500).json({ error: "Failed to complete interview" });
  }
}

// GET /api/interview/sessions
export async function getSessions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const sessions = await InterviewSession.find({ userId })
      .sort({ createdAt: -1 })
      .select("language topic difficulty questionCount overallScore status interviewType createdAt")
      .limit(50);

    res.json({ sessions });
  } catch (error: any) {
    console.error("[Interview] List error:", error.message);
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
}

// GET /api/interview/sessions/:id
export async function getSession(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const session = await InterviewSession.findOne({ _id: req.params.id, userId });
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    res.json(session);
  } catch (error: any) {
    console.error("[Interview] Get error:", error.message);
    res.status(500).json({ error: "Failed to fetch session" });
  }
}

// DELETE /api/interview/sessions/:id
export async function deleteSession(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    await InterviewSession.deleteOne({ _id: req.params.id, userId });
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Interview] Delete error:", error.message);
    res.status(500).json({ error: "Failed to delete session" });
  }
}
