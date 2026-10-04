import { classifyMessage, sentence } from "./classifier.js";
import { tokenize } from "../intent/analyze.js";

export class ConversationMemory {
  constructor(messages = []) {
    this.turns = [];
    this.state = {
      originalGoal: null,
      activeRequirements: [],
      activeConstraints: [],
      decisions: [],
      rejectedApproaches: [],
      implementationDetails: [],
      superseded: [],
    };
    if (Array.isArray(messages) && messages.length > 0) {
      this.load(messages);
    }
  }

  load(messages) {
    for (const msg of messages) {
      const text = typeof msg === "string" ? msg : msg?.content || "";
      const role = typeof msg === "object" ? msg?.role || "user" : "user";
      if (text) this.addTurn(role, text);
    }
  }

  addTurn(role, content) {
    const classification = classifyMessage(content);
    const turn = {
      index: this.turns.length + 1,
      role,
      content: content.trim(),
      category: classification.category,
      details: classification.details,
      timestamp: Date.now(),
    };
    this.turns.push(turn);
    this.updateState(turn);
    return turn;
  }

  updateState(turn) {
    if (turn.category === "IRRELEVANT") return;

    if (!this.state.originalGoal && (turn.category === "REQUIREMENT" || turn.category === "IMPLEMENTATION_DETAIL")) {
      this.state.originalGoal = sentence(turn.content);
    }

    if (turn.category === "CORRECTION") {
      const correctionTokens = tokenize(turn.content);
      const isConflictingConstraint = (text) => {
        const constraintTokens = tokenize(text);
        const overlap = constraintTokens.filter((t) => correctionTokens.includes(t));
        return overlap.length >= 1;
      };

      // Supersede matching constraints
      const removedCons = this.state.activeConstraints.filter(isConflictingConstraint);
      this.state.activeConstraints = this.state.activeConstraints.filter((c) => !isConflictingConstraint(c));

      for (const item of removedCons) {
        this.state.superseded.push({
          item,
          supersededBy: sentence(turn.content),
          turnIndex: turn.index,
        });
      }

      this.state.decisions.push(`Latest correction: ${sentence(turn.content)}`);
      this.state.activeRequirements.push(sentence(turn.content));
      return;
    }

    if (turn.category === "CONSTRAINT") {
      for (const c of turn.details.length ? turn.details : [sentence(turn.content)]) {
        if (!this.state.activeConstraints.includes(c)) {
          this.state.activeConstraints.push(c);
        }
      }
    } else if (turn.category === "REJECTED_APPROACH") {
      for (const r of turn.details.length ? turn.details : [sentence(turn.content)]) {
        this.state.rejectedApproaches.push(r);
      }
    } else if (turn.category === "IMPLEMENTATION_DETAIL") {
      this.state.implementationDetails.push(sentence(turn.content));
    } else if (turn.category === "REQUIREMENT") {
      const req = sentence(turn.content);
      if (!this.state.activeRequirements.includes(req)) {
        this.state.activeRequirements.push(req);
      }
    }
  }

  getSnapshot() {
    return {
      originalGoal: this.state.originalGoal,
      requirements: [...new Set(this.state.activeRequirements)].slice(-10),
      constraints: [...new Set(this.state.activeConstraints)].slice(-10),
      decisions: [...new Set(this.state.decisions)].slice(-6),
      rejectedApproaches: [...new Set(this.state.rejectedApproaches)].slice(-5),
      implementationDetails: [...new Set(this.state.implementationDetails)].slice(-6),
      superseded: [...this.state.superseded],
      turnsCount: this.turns.length,
    };
  }
}

export function buildConversationContext(messages = []) {
  const memory = new ConversationMemory(messages);
  return memory.getSnapshot();
}
