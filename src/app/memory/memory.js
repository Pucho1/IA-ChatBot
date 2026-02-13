import { buildPrompt } from "../intelligence/buildPrompt";
import { maybeExtractFacts } from "../intelligence/maybeExtractFacts";
import { storeFact } from "./factStore";
import { materializeFacts } from "./materializeFacts";
import { storeSummary } from "./sumaryStore";

export class Memory {

    constructor(state) {
        this.state = state;
    };

    addUserMessage(content) {
        this.state.messages.push({
            role: "user",
            content
        });
    };

    addAssistantMessage(content) {
        this.state.messages.push({
            role: "assistant",
            content
        });
    };

    async processIncomingFacts(rawMessage) {

        const extracted = await maybeExtractFacts(rawMessage);
        const materialized = materializeFacts(extracted);

        storeFact(this.state, materialized);
    };

    buildPrompt() {
        return buildPrompt({ memory: this.state });
    };

    async updateSummaryIfNeeded(){
        await storeSummary( this.state);
    };

    get messages() {
        return this.state.messages;
    };

    get facts() {
        return this.state.facts;
    };

    get summary() {
        return this.state.summary;
    };
};
