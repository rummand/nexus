/**
 * The only shape the model may answer in.
 *
 * A closed schema is the first half of the boundary and `validate.ts` is the second: this stops
 * the model saying something structurally strange, and the validator stops it saying something
 * untrue. `change` is an enum of five verbs — there is deliberately no verb for deleting an
 * object, editing a board, or reaching anything outside the graph.
 */
export const PROPOSE_SCHEMA = {
  type: "object",
  properties: {
    proposals: {
      type: "array",
      description: "Changes to the model. Fewer, well-evidenced ones are worth more than a long list.",
      items: {
        type: "object",
        properties: {
          change: {
            type: "string",
            enum: ["setKind", "renameKind", "merge", "setAttribute", "addRelation"],
            description: "What kind of change this is.",
          },
          why: { type: "string", description: "One sentence a reviewer can judge. Say what you read, not that you are confident." },
          readFrom: { type: "string", description: "The id of the object whose words justify this." },
          quote: { type: "string", description: "The words, copied exactly from that object's kind, name, description or attributes." },
          confidence: { type: "string", enum: ["medium", "low"] },
          entityId: { type: "string", description: "setKind, setAttribute: the object to change." },
          to: { type: "string", description: "setKind: the kind. renameKind: the new name. setAttribute: the value." },
          from: { type: "string", description: "renameKind: the kind as it is spelled now." },
          key: { type: "string", description: "setAttribute: the attribute key." },
          survivorId: { type: "string", description: "merge: the object to keep." },
          otherIds: { type: "array", items: { type: "string" }, description: "merge: the objects to fold into it." },
          fromEntityId: { type: "string", description: "addRelation: the source object." },
          toEntityId: { type: "string", description: "addRelation: the target object." },
          relationKind: { type: "string", description: "addRelation: the relation type, e.g. depends on." },
        },
        required: ["change", "why", "readFrom", "quote"],
      },
    },
    note: {
      type: "string",
      description: "One or two sentences to the architect about what you saw. No markdown.",
    },
  },
  required: ["proposals"],
} as const;
