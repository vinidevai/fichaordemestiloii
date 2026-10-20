import { defineDossieSheet, MODULE_ID } from "./dossie-sheet.mjs";

/**
 * A ficha do módulo herda da ficha de agente do sistema (OrdemActorSheet), então
 * rolagens, arrastar itens, efeitos e demais ações continuam sendo as do sistema.
 * O sistema registra a classe no hook "init" dele, que roda antes do hook dos módulos.
 */
Hooks.once("init", () => {
	if (game.system.id !== "ordemparanormal") return;

	const registered = Object.values(CONFIG.Actor.sheetClasses?.agent ?? {});
	const Base = registered.find((s) => s.id === "ordemparanormal.OrdemActorSheet")?.cls;
	if (!Base) {
		console.error(`${MODULE_ID} | Ficha de agente do sistema não encontrada; a ficha Dossiê não foi registrada.`);
		return;
	}

	const DossieSheet = defineDossieSheet(Base);
	foundry.documents.collections.Actors.registerSheet(MODULE_ID, DossieSheet, {
		types: ["agent"],
		makeDefault: true,
		label: "Ordem Paranormal — Dossiê (Playtest)",
	});
});
