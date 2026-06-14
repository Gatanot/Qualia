export interface SteeringMessage {
	messageId: string;
	text: string;
}

export const pendingSteering = new Map<string, SteeringMessage[]>();
