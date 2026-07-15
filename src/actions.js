import { sendCommand } from './api.js'
import { outputChoices, routeTargetChoices, sceneChoices, clientChoices } from './choices.js'

export default function UpdateActions(self) {
	const outputs = outputChoices(self)
	const scenes = sceneChoices(self)
	const clients = clientChoices(self)

	self.setActionDefinitions({
		route: {
			name: 'Route Output',
			options: [
				{
					id: 'outputId',
					type: 'dropdown',
					label: 'Output',
					choices: outputs,
					default: outputs[0]?.id ?? '',
				},
				{
					id: 'sourceId',
					type: 'dropdown',
					label: 'Source / Scene',
					choices: routeTargetChoices(self),
					default: '',
				},
			],
			callback: async (event) => {
				await sendCommand(self, {
					type: 'route',
					outputId: event.options.outputId,
					sourceId: event.options.sourceId || null,
				})
			},
		},
		blackout: {
			name: 'Blackout Output',
			options: [
				{
					id: 'outputId',
					type: 'dropdown',
					label: 'Output',
					choices: outputs,
					default: outputs[0]?.id ?? '',
				},
			],
			callback: async (event) => {
				await sendCommand(self, { type: 'blackout', outputId: event.options.outputId })
			},
		},
		recallPreset: {
			name: 'Recall Scene to Output',
			options: [
				{
					id: 'outputId',
					type: 'dropdown',
					label: 'Output',
					choices: outputs,
					default: outputs[0]?.id ?? '',
				},
				{
					id: 'sceneId',
					type: 'dropdown',
					label: 'Scene',
					choices: scenes,
					default: scenes[0]?.id ?? '',
				},
			],
			callback: async (event) => {
				await sendCommand(self, {
					type: 'recall-preset',
					outputId: event.options.outputId,
					sceneId: event.options.sceneId,
				})
			},
		},
		sendNote: {
			name: 'Send Note to Stage',
			options: [{ id: 'message', type: 'textinput', label: 'Message', default: '' }],
			callback: async (event) => {
				await sendCommand(self, { type: 'send-note', message: event.options.message })
			},
		},
		nextSlide: {
			name: 'Next Slide',
			options: [
				{
					id: 'clientId',
					type: 'dropdown',
					label: 'Client Node',
					choices: clients,
					default: clients[0]?.id ?? '',
				},
			],
			callback: async (event) => {
				await sendCommand(self, { type: 'next-slide', clientId: event.options.clientId })
			},
		},
		previousSlide: {
			name: 'Previous Slide',
			options: [
				{
					id: 'clientId',
					type: 'dropdown',
					label: 'Client Node',
					choices: clients,
					default: clients[0]?.id ?? '',
				},
			],
			callback: async (event) => {
				await sendCommand(self, { type: 'previous-slide', clientId: event.options.clientId })
			},
		},
	})
}
