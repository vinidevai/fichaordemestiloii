import { defineDossieSheet, MODULE_ID } from "./dossie-sheet.mjs";

const SYSTEM_ID = "ordemparanormal";
const SHEET_LABEL = "Ordem Paranormal — Dossiê (Playtest)";

/**
 * Pega a ficha de agente do sistema. O caminho principal é importar o arquivo do próprio sistema
 * (o navegador reaproveita o módulo já carregado, então é a mesma classe); isso não depende de
 * detalhes internos do Foundry que mudam entre versões. Como plano B, procura em CONFIG.
 */
async function findBaseSheet() {
	try {
		const url = foundry.utils.getRoute(`systems/${SYSTEM_ID}/module/sheets/actor-sheet.mjs`);
		const mod = await import(url);
		if (mod?.OrdemActorSheet) return mod.OrdemActorSheet;
	} catch (err) {
		console.warn(`${MODULE_ID} | Não consegui importar a ficha do sistema; tentando pelo CONFIG.`, err);
	}

	const groups = Object.values(CONFIG.Actor.sheetClasses ?? {});
	for (const group of groups) {
		for (const entry of Object.values(group ?? {})) {
			if (entry?.cls?.name === "OrdemActorSheet") return entry.cls;
		}
	}
	return null;
}

/** Registra a ficha tentando a API nova e, se falhar, a antiga. */
function registerSheet(DossieSheet) {
	const options = { types: ["agent"], makeDefault: true, label: SHEET_LABEL };
	const documentClass = CONFIG.Actor.documentClass;
	const attempts = [
		() => foundry.applications.apps.DocumentSheetConfig.registerSheet(documentClass, MODULE_ID, DossieSheet, options),
		() => foundry.documents.collections.Actors.registerSheet(MODULE_ID, DossieSheet, options),
	];

	const errors = [];
	for (const attempt of attempts) {
		try {
			attempt();
			return null;
		} catch (err) {
			errors.push(err);
		}
	}
	return errors[errors.length - 1];
}

let failure = null;

Hooks.once("init", async () => {
	if (game.system.id !== SYSTEM_ID) return;

	try {
		const Base = await findBaseSheet();
		if (!Base) throw new Error("ficha de agente do sistema Ordem Paranormal não encontrada");

		const DossieSheet = defineDossieSheet(Base);
		const error = registerSheet(DossieSheet);
		if (error) throw error;

		game.modules.get(MODULE_ID).api = { DossieSheet };
		console.log(`${MODULE_ID} | Ficha Dossiê registrada (Foundry ${game.version}).`);
	} catch (err) {
		failure = err;
		console.error(`${MODULE_ID} | Falha ao registrar a ficha Dossiê.`, err);
	}
});

Hooks.once("ready", () => {
	if (failure && game.user.isGM) {
		ui.notifications.error(
			`${SHEET_LABEL}: não foi possível registrar a ficha (${failure.message}). Veja o console (F12) e abra uma issue no GitHub.`,
			{ permanent: true }
		);
	}
});
