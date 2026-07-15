import { outputChoices, routeTargetChoices, clientChoices } from './choices.js'

export default function UpdateFeedbacks(self) {
	const outputs = outputChoices(self)
	const clients = clientChoices(self)

	self.setFeedbackDefinitions({
		outputRouted: {
			type: 'boolean',
			name: 'Output is routed to a specific source/scene',
			description: 'Highlights the button when the chosen output is currently routed to the chosen source or scene.',
			defaultStyle: { bgcolor: 0x00aa00, color: 0xffffff },
			options: [
				{
					id: 'outputId',
					type: 'dropdown',
					label: 'Output',
					choices: outputs,
					default: outputs[0]?.id ?? '',
				},
				{
					id: 'targetId',
					type: 'dropdown',
					label: 'Source / Scene',
					choices: routeTargetChoices(self),
					default: '',
				},
			],
			callback: (feedback) => {
				const output = self.state?.outputs.find((o) => o.id === feedback.options.outputId)
				return !!output && output.routedSourceId === (feedback.options.targetId || null)
			},
		},
		clientOnline: {
			type: 'boolean',
			name: 'Client Node is online',
			description: 'Highlights the button while the chosen Client Node is connected.',
			defaultStyle: { bgcolor: 0x00aa00, color: 0xffffff },
			options: [
				{
					id: 'clientId',
					type: 'dropdown',
					label: 'Client Node',
					choices: clients,
					default: clients[0]?.id ?? '',
				},
			],
			callback: (feedback) => {
				const client = self.state?.clients.find((c) => c.id === feedback.options.clientId)
				return !!client?.online
			},
		},
	})
}
