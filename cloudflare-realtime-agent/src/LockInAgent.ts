import {
  DeepgramSTT,
  TextComponent,
  RealtimeKitTransport,
  ElevenLabsTTS,
  RealtimeAgent,
} from "@cloudflare/realtime-agents";

export interface Env {
  AI: any;
  DEEPGRAM_API_KEY: string;
  ELEVENLABS_API_KEY: string;
  CONVEX_URL: string;
  ACCOUNT_ID: string;
  API_TOKEN: string;
}

// Custom text processor for coding assistance
class CodingAssistantProcessor extends TextComponent {
  env: Env;
  sessionId: string;
  userId: string;
  sessionContext: {
    projectTitle?: string;
    sessionType: "coding" | "study" | "general";
  };

  constructor(
    env: Env,
    sessionId: string,
    userId: string,
    sessionContext: {
      projectTitle?: string;
      sessionType: "coding" | "study" | "general";
    }
  ) {
    super();
    this.env = env;
    this.sessionId = sessionId;
    this.userId = userId;
    this.sessionContext = sessionContext;
  }

  // Process transcribed speech and generate AI responses
  async onTranscript(text: string, reply: (response: string) => void) {
    console.log(`[AI Assistant] User said: "${text}"`);

    // Check if the user is asking for help
    const isHelpRequest = this.detectHelpRequest(text);

    if (!isHelpRequest) {
      // Don't respond to everything - only when explicitly asked
      return;
    }

    try {
      // Build context-aware prompt
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(text);

      // Call Workers AI with Llama for coding assistance
      const { response: aiResponse } = await this.env.AI.run(
        "@cf/meta/llama-3.1-8b-instruct",
        {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 256, // Keep responses concise for voice
        }
      );

      console.log(`[AI Assistant] Response: "${aiResponse}"`);

      // Log the interaction to Convex
      await this.logToConvex(text, aiResponse);

      // Respond via voice
      reply(aiResponse);
    } catch (error) {
      console.error("[AI Assistant] Error:", error);
      reply(
        "I'm having trouble processing that right now. Could you try asking again?"
      );
    }
  }

  // Detect if user is asking for help
  private detectHelpRequest(text: string): boolean {
    const helpKeywords = [
      "hey agent",
      "help",
      "stuck",
      "how do i",
      "how can i",
      "what should i",
      "can you help",
      "assist",
      "explain",
      "debug",
      "error",
      "problem",
      "issue",
      "tip",
      "suggestion",
    ];

    const lowerText = text.toLowerCase();
    return helpKeywords.some((keyword) => lowerText.includes(keyword));
  }

  // Build system prompt based on session context
  private buildSystemPrompt(): string {
    let prompt = `You are a helpful AI coding assistant in a Lock In Session - a focused work session where developers work on their projects.

Your role is to:
1. Provide quick, actionable coding tips and suggestions
2. Help debug issues when users get stuck
3. Encourage and motivate during long coding sessions
4. Keep responses CONCISE (2-3 sentences max) since they will be spoken aloud

Guidelines:
- Be friendly and encouraging
- Give specific, actionable advice
- If you don't have enough context, ask clarifying questions
- Keep responses short for voice output`;

    if (this.sessionContext.projectTitle) {
      prompt += `\n\nThe user is working on a project called "${this.sessionContext.projectTitle}".`;
    }

    if (this.sessionContext.sessionType === "coding") {
      prompt += `\n\nThis is a coding-focused session. Provide programming-related assistance.`;
    } else if (this.sessionContext.sessionType === "study") {
      prompt += `\n\nThis is a study session. Help with learning and understanding concepts.`;
    }

    return prompt;
  }

  // Build user prompt from transcribed speech
  private buildUserPrompt(text: string): string {
    return `User question: ${text}\n\nProvide a helpful, concise response (2-3 sentences max for voice output).`;
  }

  // Log AI interaction to Convex
  private async logToConvex(question: string, response: string) {
    try {
      const convexUrl = this.env.CONVEX_URL;

      await fetch(`${convexUrl}/lockInSession/aiLog`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          userId: this.userId,
          question,
          response,
        }),
      });

      console.log("[AI Assistant] Logged interaction to Convex");
    } catch (error) {
      console.error("[AI Assistant] Failed to log to Convex:", error);
      // Don't fail the response if logging fails
    }
  }

  // Manually trigger AI to speak (called from Worker)
  triggerResponse(message: string) {
    this.speak(message);
  }
}

// Main AI Agent Durable Object
export class LockInAgent extends RealtimeAgent<Env> {
  private processor?: CodingAssistantProcessor;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async init(
    agentId: string,
    meetingId: string,
    authToken: string,
    workerUrl: string,
    accountId: string,
    apiToken: string,
    sessionId: string,
    userId: string,
    sessionContext: {
      projectTitle?: string;
      sessionType: "coding" | "study" | "general";
    }
  ) {
    console.log(`[LockInAgent] Initializing agent for session: ${sessionId}`);

    // Create coding assistant processor
    this.processor = new CodingAssistantProcessor(
      this.env,
      sessionId,
      userId,
      sessionContext
    );

    // Create RealtimeKit transport for the meeting
    const rtkTransport = new RealtimeKitTransport(meetingId, authToken);
    const { meeting } = rtkTransport;

    // Build the AI pipeline:
    // Audio → Speech-to-Text → AI Processing → Text-to-Speech → Audio
    await this.initPipeline(
      [
        rtkTransport, // Input: Meeting audio
        new DeepgramSTT(this.env.DEEPGRAM_API_KEY), // Transcribe speech
        this.processor, // Process with AI
        new ElevenLabsTTS(this.env.ELEVENLABS_API_KEY), // Convert response to speech
        rtkTransport, // Output: Back to meeting
      ],
      agentId,
      workerUrl,
      accountId,
      apiToken
    );

    // Register meeting event handlers
    meeting.participants.joined.on("participantJoined", (participant) => {
      console.log(`[LockInAgent] Participant joined: ${participant.name}`);
      this.processor?.triggerResponse(
        `Welcome ${participant.name}! I'm your AI coding assistant. Say "hey agent" if you need help.`
      );
    });

    meeting.participants.joined.on("participantLeft", (participant) => {
      console.log(`[LockInAgent] Participant left: ${participant.name}`);
    });

    // Join the meeting
    await meeting.join();
    console.log(`[LockInAgent] Agent joined meeting successfully`);

    // Announce agent presence
    this.processor.triggerResponse(
      "Hello! I'm your AI coding assistant. I'm here to help when you get stuck. Just say 'hey agent' followed by your question."
    );
  }

  async deinit() {
    console.log("[LockInAgent] Shutting down agent");
    await this.deinitPipeline();
  }
}
