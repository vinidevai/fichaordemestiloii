export const MODULE_ID = "op-ficha-playtest";
const TPL = `modules/${MODULE_ID}/templates`;

/** Cores de destaque disponíveis (a primeira é o padrão geral). */
export const PALETTE = [
	{ id: "red", color: "#d6391f" },
	{ id: "blue", color: "#3f78d1" },
	{ id: "green", color: "#4d9a2f" },
	{ id: "amber", color: "#d9992a" },
	{ id: "purple", color: "#9156d3" },
	{ id: "bone", color: "#d8d2c0" },
];

/** Texturas de fundo disponíveis (arquivos em /textures). A primeira é a padrão. */
export const TEXTURES = ["tecido", "concreto", "papel", "liso", "nevoa"];

/** Cor padrão pela classe do agente, quando o jogador não escolheu uma. */
const CLASS_ACCENT = [
	[/combat/i, "red"],
	[/especial/i, "blue"],
	[/ocult/i, "purple"],
	[/sobreviv/i, "green"],
];

/** Formato do selo de cada grau de treinamento (o mesmo vocabulário visual do playtest). */
const DEGREE_SHAPE = {
	untrained: "tri",
	trained: "sq",
	veteran: "dia",
	expert: "hex",
};
const DEGREE_CYCLE = ["untrained", "trained", "veteran", "expert"];
const DEGREE_TIP = {
	untrained: "OPDOSSIE.Degree.untrained",
	trained: "OPDOSSIE.Degree.trained",
	veteran: "OPDOSSIE.Degree.veteran",
	expert: "OPDOSSIE.Degree.expert",
};

/** Ordem dos atributos na ficha (mesma do sistema). */
const ATTRIBUTES = [
	{ key: "dex", label: "op.attDex", abv: "op.dexAbv" },
	{ key: "str", label: "op.attStr", abv: "op.strAbv" },
	{ key: "int", label: "op.attInt", abv: "op.intAbv" },
	{ key: "pre", label: "op.attPre", abv: "op.preAbv" },
	{ key: "vit", label: "op.attVit", abv: "op.vitAbv" },
];

const TAB_ICONS = {
	skills: "fa-solid fa-dice-d20",
	inventory: "fa-solid fa-suitcase",
	abilities: "fa-solid fa-bahai",
	rituals: "fa-solid fa-book-skull",
	biography: "fa-solid fa-fingerprint",
	effects: "fa-solid fa-wand-sparkles",
};

/** Acima disso a barra de blocos vira uma tira contínua. */
const MAX_BLOCKS = 30;

/**
 * Cria a ficha Dossiê em cima da ficha de agente do sistema.
 * @param {typeof foundry.applications.api.DocumentSheetV2} Base  OrdemActorSheet do sistema.
 */
export function defineDossieSheet(Base) {
	const { agent, tabs, skills, ...systemParts } = Base.PARTS;

	return class OrdemDossieSheet extends Base {
		static DEFAULT_OPTIONS = {
			classes: ["op-dossie"],
			position: { width: 860, height: 790 },
			actions: {
				showPortrait: OrdemDossieSheet._onShowPortrait,
				setResource: OrdemDossieSheet._onSetResource,
				cycleDegree: OrdemDossieSheet._onCycleDegree,
				setAccent: OrdemDossieSheet._onSetAccent,
				setTexture: OrdemDossieSheet._onSetTexture,
			},
		};

		static PARTS = {
			dossie: { id: "dossie", template: `${TPL}/dossie.hbs` },
			tabs: { id: "tabs", template: `${TPL}/tabs.hbs` },
			skills: { id: "skills", template: `${TPL}/skills.hbs`, scrollable: [""] },
			...systemParts,
		};

		/* -------------------------------------------- */
		/*  Moldura e partes                            */
		/* -------------------------------------------- */

		/** O tema escuro precisa substituir o "theme-light" herdado da ficha do sistema. */
		async _renderFrame(options) {
			const frame = await super._renderFrame(options);
			frame.classList.remove("theme-light");
			frame.classList.add("theme-dark");
			return frame;
		}

		/** @override */
		_configureRenderOptions(options) {
			super._configureRenderOptions(options);
			options.parts = ["dossie"];
			if (this.document.limited) return;
			options.parts.push("tabs", "skills", "inventory", "abilities", "rituals", "biography", "effects");
		}

		/** @override */
		async _onRender(context, options) {
			await super._onRender(context, options);
			this.element.style.setProperty("--op-accent", context.accent.color);
			this.element.dataset.opTexture = context.texture;

			// A paleta fica aberta enquanto o jogador experimenta cores (cada troca re-renderiza a ficha).
			const palette = this.element.querySelector(".op-palette");
			if (palette) {
				palette.open = !!this._paletteOpen;
				palette.addEventListener("toggle", () => (this._paletteOpen = palette.open));
			}
		}

		/**
		 * Gera a navegação por abas. Só as partes que são abas entram (o sistema original
		 * também listaria partes desconhecidas, como o cabeçalho).
		 * @override
		 */
		_getTabs(parts) {
			const group = "primary";
			if (!this.tabGroups[group]) this.tabGroups[group] = "skills";
			return parts.reduce((acc, partId) => {
				if (!TAB_ICONS[partId]) return acc;
				acc[partId] = {
					id: partId,
					group,
					icon: TAB_ICONS[partId],
					label: `op.tab.${partId}`,
					cssClass: this.tabGroups[group] === partId ? "active" : "",
				};
				return acc;
			}, {});
		}

		/* -------------------------------------------- */
		/*  Contexto                                    */
		/* -------------------------------------------- */

		/** @override */
		async _prepareContext(options) {
			const context = await super._prepareContext(options);
			const system = this.actor.system;
			const noSanity = this.usingWithoutSanityRule;

			context.accent = this._getAccent(context.details?.class);
			context.palette = PALETTE.map((p) => ({
				...p,
				label: game.i18n.localize(`OPDOSSIE.Color.${p.id}`),
				active: p.color === context.accent.color,
			}));
			const savedTexture = this.actor.getFlag(MODULE_ID, "texture");
			context.texture = TEXTURES.includes(savedTexture) ? savedTexture : TEXTURES[0];
			context.textures = TEXTURES.map((id) => ({
				id,
				label: game.i18n.localize(`OPDOSSIE.Texture.${id}`),
				active: id === context.texture,
			}));
			context.detailSlots = ["class", "origin", "path"].map((type) => ({
				type,
				item: context.details?.[type] ?? null,
				label: game.i18n.localize(`TYPES.Item.${type}`),
			}));
			context.attributes = ATTRIBUTES.map((a) => ({
				key: a.key,
				label: game.i18n.localize(a.label),
				abv: game.i18n.localize(a.abv).toUpperCase(),
				value: system.attributes[a.key]?.value ?? 0,
			}));
			context.resourceBars = (noSanity ? ["PV", "PD"] : ["PV", "SAN", "PE"]).map((key) => this._prepareResource(key));
			context.skillRows = this._prepareSkillRows(system, context.skillTotals);
			context.portrait = { src: this.actor.img, name: this.actor.name };
			return context;
		}

		/** Cor escolhida pelo jogador, ou a padrão da classe. */
		_getAccent(classItem) {
			const flagged = this.actor.getFlag(MODULE_ID, "accent");
			if (typeof flagged === "string" && /^#[0-9a-f]{6}$/i.test(flagged)) return { color: flagged, custom: true };
			const className = classItem?.name ?? "";
			const hit = CLASS_ACCENT.find(([rx]) => rx.test(className));
			const id = hit ? hit[1] : "red";
			return { color: PALETTE.find((p) => p.id === id).color, custom: false };
		}

		_prepareResource(key) {
			const res = this.actor.system[key];
			const value = Number(res.value) || 0;
			const max = Math.max(0, Number(res.max) || 0);
			const asBlocks = max > 0 && max <= MAX_BLOCKS;
			const names = { PV: "op.PV", PE: "op.PE", PD: "op.PD", SAN: "op.San" };
			return {
				key,
				short: key,
				name: game.i18n.localize(names[key]),
				value,
				max,
				locked: !!this.actor.system.isDerivatedCalcsActive,
				asBlocks,
				blocks: asBlocks ? Array.from({ length: max }, (_, i) => ({ n: i + 1, on: i + 1 <= value })) : [],
				pct: max ? Math.round(Math.clamp(value / max, 0, 1) * 100) : 0,
				perRound: key === "PE" || key === "PD" ? res.perRound : null,
			};
		}

		_prepareSkillRows(system, totals = {}) {
			const rows = Object.entries(system.skills).map(([key, skill]) => {
				const attrKey = skill.attr?.[0] ?? "int";
				const degree = skill.degree?.label ?? "untrained";
				const total = Number(totals[key] ?? 0);
				const isFree = key === "freeSkill";
				return {
					key,
					isFree,
					name: skill.name ?? "",
					label: skill.label ?? key,
					attrAbv: game.i18n.localize(`op.${attrKey}Abv`).toUpperCase(),
					attrValue: system.attributes[attrKey]?.value ?? 0,
					degree,
					shape: DEGREE_SHAPE[degree] ?? "hex",
					degreeTip: game.i18n.localize(DEGREE_TIP[degree] ?? DEGREE_TIP.untrained),
					total: total >= 0 ? `+${total}` : `${total}`,
					mod: skill.mod ?? 0,
					trained: degree !== "untrained",
				};
			});
			const collator = new Intl.Collator(game.i18n.lang, { sensitivity: "base" });
			return rows.sort((a, b) => Number(a.isFree) - Number(b.isFree) || collator.compare(a.label, b.label));
		}

		/* -------------------------------------------- */
		/*  Ações                                       */
		/* -------------------------------------------- */

		/** Abre o retrato inteiro (a ficha só mostra um recorte do topo). */
		static _onShowPortrait(event, target) {
			event.preventDefault();
			const ImagePopout = foundry.applications.apps.ImagePopout;
			new ImagePopout({
				src: this.actor.img,
				uuid: this.actor.uuid,
				window: { title: this.actor.name },
			}).render({ force: true });
		}

		/** Clicar no bloco N define o recurso para N; clicar no último bloco cheio esvazia ele. */
		static async _onSetResource(event, target) {
			event.preventDefault();
			if (!this.isEditable) return;
			const { res, value } = target.dataset;
			const current = Number(this.actor.system[res]?.value) || 0;
			const wanted = Number(value);
			if (!Number.isFinite(wanted)) return;
			const next = current === wanted ? wanted - 1 : wanted;
			await this.actor.update({ [`system.${res}.value`]: Math.max(0, next) });
		}

		/** Passa o perito para o próximo grau de treinamento (destreinado → treinado → veterano → expert). */
		static async _onCycleDegree(event, target) {
			event.preventDefault();
			if (!this.isEditable) return;
			const key = target.closest("[data-key]")?.dataset.key;
			const skill = this.actor.system.skills[key];
			if (!skill) return;
			const index = DEGREE_CYCLE.indexOf(skill.degree?.label);
			const next = DEGREE_CYCLE[(index + 1) % DEGREE_CYCLE.length];
			await this.actor.update({ [`system.skills.${key}.degree.label`]: next });
		}

		/** Guarda a cor de destaque da ficha (por personagem). */
		static async _onSetAccent(event, target) {
			event.preventDefault();
			if (!this.actor.isOwner) return;
			const { color } = target.dataset;
			if (color === "auto") await this.actor.unsetFlag(MODULE_ID, "accent");
			else await this.actor.setFlag(MODULE_ID, "accent", color);
		}

		/** Guarda a textura de fundo da ficha (por personagem). */
		static async _onSetTexture(event, target) {
			event.preventDefault();
			if (!this.actor.isOwner) return;
			const { tex } = target.dataset;
			if (!TEXTURES.includes(tex)) return;
			await this.actor.setFlag(MODULE_ID, "texture", tex);
		}
	};
}
