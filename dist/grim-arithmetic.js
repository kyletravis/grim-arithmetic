var e = {
	id: "grim-arithmetic",
	title: "Grim Arithmetic",
	description: "GM-facing PF2e mortality and encounter-risk analysis for Foundry VTT.",
	version: "0.6.1",
	authors: [{ name: "Kyle Travis" }],
	compatibility: {
		minimum: "13",
		verified: "14.361"
	},
	system: ["pf2e"],
	relationships: { systems: [{
		id: "pf2e",
		type: "system"
	}] },
	esmodules: ["dist/grim-arithmetic.js"],
	styles: ["styles/grim-arithmetic.css"],
	templates: [
		"templates/pair-detail-panel.hbs",
		"templates/danger-board-panel.hbs",
		"templates/forecast-panel.hbs"
	],
	url: "https://github.com/kyletravis/grim-arithmetic",
	manifest: "https://github.com/kyletravis/grim-arithmetic/releases/latest/download/module.json",
	download: "https://github.com/kyletravis/grim-arithmetic/releases/download/v0.6.1/grim-arithmetic-v0.6.1.zip"
}, t = "grim-arithmetic", n = "Grim Arithmetic", r = e.version;
//#endregion
//#region src/debug-capture.ts
function i(e) {
	let t = e.actor, n = d(t?.system);
	return {
		token: {
			id: e.id,
			name: e.name,
			disposition: e.document?.disposition
		},
		actor: t ? {
			id: t.id,
			name: t.name,
			type: t.type,
			system: o(n),
			itemTypes: l(t.itemTypes),
			meleeItems: u(t.items).filter((e) => e.type === "melee").map((e) => ({
				id: e.id,
				name: e.name,
				type: e.type,
				system: {
					bonus: d(e.system).bonus,
					attack: d(e.system).attack,
					damageRolls: d(e.system).damageRolls,
					traits: d(e.system).traits
				}
			}))
		} : null
	};
}
function a(e) {
	if (!e || !(typeof game < "u" && game.user?.isGM === !0) || !(typeof game < "u" && (game.settings?.get?.("grim-arithmetic", "debugLogging") ?? !1))) return null;
	let t = i(e);
	return console.log("Grim Arithmetic | Debug capture", t), t;
}
function o(e) {
	let t = c({
		immunities: e.immunities,
		weaknesses: e.weaknesses,
		resistances: e.resistances
	});
	return c({
		attributes: s(e),
		saves: e.saves,
		traits: e.traits,
		legacyDamageAdjustments: Object.keys(t).length > 0 ? t : void 0
	});
}
function s(e) {
	let t = d(e.attributes);
	return c({
		hp: t.hp,
		ac: t.ac,
		immunities: t.immunities,
		weaknesses: t.weaknesses,
		resistances: t.resistances
	});
}
function c(e) {
	return Object.fromEntries(Object.entries(e).filter(([, e]) => e !== void 0));
}
function l(e) {
	return { condition: d(e).condition };
}
function u(e) {
	if (Array.isArray(e)) return e.filter(f);
	let t = d(e).contents;
	if (Array.isArray(t)) return t.filter(f);
	if (f(e) && typeof e.filter == "function") {
		let t = e.filter(f);
		return Array.isArray(t) ? t.filter(f) : [];
	}
	return [];
}
function d(e) {
	return f(e) ? e : {};
}
function f(e) {
	return typeof e == "object" && !!e;
}
//#endregion
//#region src/settings.ts
var p = "enableMonteCarlo";
function m() {
	game.settings.register(t, "defaultStrikes", {
		name: "Default enemy Strike count",
		hint: "Default number of Strikes used for immediate-threat estimates.",
		scope: "world",
		config: !0,
		type: Number,
		default: 2,
		choices: {
			1: "1 Strike",
			2: "2 Strikes",
			3: "3 Strikes"
		}
	}), game.settings.register(t, "debugLogging", {
		name: "Debug logging",
		hint: "Log Grim Arithmetic debug information to the browser console.",
		scope: "client",
		config: !0,
		type: Boolean,
		default: !1
	}), game.settings.register(t, p, {
		name: "Enable Monte Carlo encounter simulation",
		hint: "Disable on low-end machines if simulation runs are too slow. The Encounter Danger Board still works either way.",
		scope: "client",
		config: !0,
		type: Boolean,
		default: !0
	});
}
function h() {
	if (typeof game > "u") return !0;
	try {
		return !!(game.settings?.get?.("grim-arithmetic", "enableMonteCarlo") ?? !0);
	} catch {
		return !0;
	}
}
//#endregion
//#region src/engine/degree-of-success.ts
var g = [
	"criticalFailure",
	"failure",
	"success",
	"criticalSuccess"
];
function _(e) {
	let { die: t, total: n, dc: r } = e, i;
	return i = n >= r + 10 ? "criticalSuccess" : n >= r ? "success" : n <= r - 10 ? "criticalFailure" : "failure", t === 20 ? v(i, 1) : t === 1 ? v(i, -1) : i;
}
function v(e, t) {
	let n = g.indexOf(e);
	return g[Math.max(0, Math.min(g.length - 1, n + t))];
}
//#endregion
//#region src/engine/attack-probability.ts
function ee(e) {
	let t = {
		criticalSuccess: 0,
		success: 0,
		failure: 0,
		criticalFailure: 0
	};
	for (let n = 1; n <= 20; n += 1) {
		let r = _({
			die: n,
			total: n + e.attackBonus,
			dc: e.ac
		});
		t[r] += 1;
	}
	return {
		criticalSuccess: t.criticalSuccess / 20,
		success: t.success / 20,
		failure: t.failure / 20,
		criticalFailure: t.criticalFailure / 20
	};
}
//#endregion
//#region src/engine/dice.ts
var y = {
	maxFormulaLength: 256,
	maxTerms: 20,
	maxDicePerTerm: 100,
	maxDieFaces: 1e3,
	maxTotalDice: 500,
	maxOutcomes: 5e4
};
function b(e) {
	return /* @__PURE__ */ Error(`Dice formula rejected: ${e}`);
}
function x(e) {
	let t = te(e).match(/[+-]?[^+-]+/g) ?? [];
	if (t.length > y.maxTerms) throw b(`too many terms (${t.length} exceeds ${y.maxTerms})`);
	let n = 0;
	for (let e of t) {
		let t = e.replace(/^[+-]/, "").match(/^(\d+)d(\d+)$/);
		if (t) {
			let r = Number(t[1]);
			if (r > y.maxDicePerTerm) throw b(`term ${e} has ${r} dice (max ${y.maxDicePerTerm})`);
			n += r;
		}
	}
	if (n > y.maxTotalDice) throw b(`too many total dice (${n} exceeds ${y.maxTotalDice})`);
	let r = new Map([[0, 1]]);
	for (let e of t) {
		let t = ne(e);
		if (t.size > y.maxOutcomes) throw b(`term ${e} produced ${t.size} outcomes (max ${y.maxOutcomes})`);
		if (r = re(r, t), r.size > y.maxOutcomes) throw b(`convolution produced ${r.size} outcomes (max ${y.maxOutcomes})`);
	}
	return ie(r, e);
}
function te(e) {
	if (e.length > y.maxFormulaLength) throw b(`formula length ${e.length} exceeds ${y.maxFormulaLength}`);
	let t = e.replace(/\s+/g, "");
	if (!/^[+-]?(\d+d\d+|\d+)([+-](\d+d\d+|\d+))*$/.test(t)) throw Error(`Unsupported damage formula: ${e}`);
	return t;
}
function ne(e) {
	let t = e.startsWith("-") ? -1 : 1, n = e.replace(/^[+-]/, ""), r = n.match(/^(\d+)d(\d+)$/);
	if (!r) return new Map([[t * Number(n), 1]]);
	let i = Number(r[1]), a = Number(r[2]);
	if (!Number.isInteger(i) || !Number.isInteger(a) || i < 1 || a < 1) throw Error(`Unsupported damage term: ${e}`);
	if (a > y.maxDieFaces) throw b(`term ${e} has ${a} faces (max ${y.maxDieFaces})`);
	let o = new Map([[0, 1]]), s = /* @__PURE__ */ new Map();
	for (let e = 1; e <= a; e += 1) s.set(t * e, 1 / a);
	for (let e = 0; e < i; e += 1) o = re(o, s);
	return o;
}
function re(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let [r, i] of e) for (let [e, a] of t) {
		let t = r + e;
		n.set(t, (n.get(t) ?? 0) + i * a);
	}
	return n;
}
function ie(e, t) {
	let n = Array.from(e.entries()).map(([e, t]) => ({
		damage: e,
		probability: t
	})).sort((e, t) => e.damage - t.damage);
	if (n.length === 0 || n.reduce((e, t) => e + t.probability, 0) <= 0) throw Error(`Unsupported damage formula: ${t}`);
	let r = n.reduce((e, t) => e + t.damage * t.probability, 0);
	return {
		min: n[0].damage,
		max: n[n.length - 1].damage,
		mean: r,
		outcomes: n
	};
}
//#endregion
//#region src/engine/mortality.ts
function ae(e) {
	let t = x(e.damageFormula), n = E(t), r = oe(e.damageType, e.targetAdjustments), i = S(t, r), a = S(n, r), o = de(e.mapType).slice(0, e.strikes), s = [], c = [], l = 0, u = 0, d = 0, f = new Map([[0, 1]]);
	for (let t of o) {
		let n = ee({
			attackBonus: e.attackBonus + t,
			ac: e.ac
		});
		s.push(n.success), c.push(n.criticalSuccess);
		let r = n.failure + n.criticalFailure;
		l += n.success * i.mean + n.criticalSuccess * a.mean, u += n.success * me(i.outcomes, e.hp), d += n.criticalSuccess * me(a.outcomes, e.hp), f = fe(f, [
			{
				damage: 0,
				probability: r
			},
			...pe(i.outcomes, n.success),
			...pe(a.outcomes, n.criticalSuccess)
		]);
	}
	let p = ge(he(f, e.hp)), m = Math.max(0, e.hp - l), h = le({
		wounded: e.wounded ?? 0,
		doomed: e.doomed ?? 0,
		assumeHeroPointAvailable: e.assumeHeroPointAvailable ?? !1
	});
	return {
		downProbability: p,
		expectedHpAfterTurn: m,
		hitChanceByStrike: s,
		critChanceByStrike: c,
		riskLabel: _e(p),
		topRiskDrivers: ve({
			downProbability: p,
			hitDownProbability: u,
			critDownProbability: d,
			highestCritChance: Math.max(...c)
		}),
		assumptions: [
			"Uses exact damage distributions for supported formulas.",
			r.note,
			"Critical damage is modeled as simple double damage of the supported formula total.",
			`Enemy turn model: ${e.strikes} Strike${e.strikes === 1 ? "" : "s"}.`,
			`MAP model: ${e.mapType}.`
		],
		notModeled: [
			"Deadly, fatal, precision, splash, and persistent damage.",
			"Reactions such as Shield Block or Champion reactions.",
			"Healing before or during the enemy turn.",
			"Permanent death probability."
		],
		damage: ye(i, a),
		dyingSeverity: h,
		damageAdjustment: r
	};
}
function oe(e, t) {
	let n = T(e), r = {
		damageType: n ?? "unknown",
		resistance: 0,
		weakness: 0,
		immune: !1,
		note: "Damage type unknown; no resistance, weakness, or immunity applied."
	};
	if (!n) return r;
	let i = C(t?.resistances ?? [], n), a = C(t?.weaknesses ?? [], n);
	if ((t?.immunities ?? []).some((e) => w(e, n))) return {
		damageType: n,
		resistance: 0,
		weakness: 0,
		immune: !0,
		note: `Applied ${n} immunity; modeled damage is 0.`
	};
	let o = [];
	return i > 0 && o.push(`${n} resistance ${i}`), a > 0 && o.push(`${n} weakness ${a}`), {
		damageType: n,
		resistance: i,
		weakness: a,
		immune: !1,
		note: o.length > 0 ? `Applied ${se(o)}.` : `No ${n} resistance, weakness, or immunity matched.`
	};
}
function se(e) {
	return e.length <= 1 ? e[0] ?? "" : `${e.slice(0, -1).join(", ")} and ${e.at(-1)}`;
}
function S(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let r of e.outcomes) {
		let e = ce(r.damage, t);
		n.set(e, (n.get(e) ?? 0) + r.probability);
	}
	let r = Array.from(n.entries()).sort(([e], [t]) => e - t).map(([e, t]) => ({
		damage: e,
		probability: t
	})), i = r.reduce((e, t) => e + t.damage * t.probability, 0);
	return {
		min: r[0]?.damage ?? 0,
		max: r.at(-1)?.damage ?? 0,
		mean: i,
		outcomes: r
	};
}
function ce(e, t) {
	return t.immune ? 0 : Math.max(0, e - t.resistance) + t.weakness;
}
function C(e, t) {
	return e.reduce((e, n) => w(n.type, t) ? Math.max(e, n.value) : e, 0);
}
function w(e, t) {
	let n = T(e), r = T(t);
	return !n || !r ? !1 : n === r || n === "all" ? !0 : n === "physical" ? r === "bludgeoning" || r === "piercing" || r === "slashing" : !1;
}
function T(e) {
	if (e) return e.trim().toLowerCase().replace(/\s+/g, "-");
}
function le({ wounded: e, doomed: t, assumeHeroPointAvailable: n }) {
	let r = Math.max(0, Math.floor(e)), i = Math.max(0, Math.floor(t)), a = Math.max(1, 4 - i), o = 1 + r, s = 2 + r;
	return {
		wounded: r,
		doomed: i,
		deathThreshold: a,
		normalDownDying: o,
		critDownDying: s,
		immediateDeathFlag: ue({
			normalDownDying: o,
			critDownDying: s,
			deathThreshold: a
		}),
		heroPointNote: n ? "Hero Point prevention is assumed available; this can prevent death but is not modeled as a survival probability." : "No Hero Point death-prevention assumption is applied."
	};
}
function ue({ normalDownDying: e, critDownDying: t, deathThreshold: n }) {
	return e >= n ? `Normal down would reach Dying ${e}, meeting or exceeding the doomed-adjusted death threshold (Dying ${n}).` : t >= n ? `Crit-down would reach Dying ${t}, meeting or exceeding the doomed-adjusted death threshold (Dying ${n}).` : t === n - 1 ? `Crit-down would put this PC at Dying ${t}, one step below the doomed-adjusted death threshold (Dying ${n}).` : `If downed, severity would be Dying ${e} on a normal hit or Dying ${t} on a critical hit.`;
}
function de(e) {
	return e === "agile" ? [
		0,
		-4,
		-8
	] : e === "none" ? [
		0,
		0,
		0
	] : [
		0,
		-5,
		-10
	];
}
function fe(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let [r, i] of e) for (let e of t) {
		if (e.probability === 0) continue;
		let t = r + e.damage, a = i * e.probability;
		n.set(t, (n.get(t) ?? 0) + a);
	}
	return n;
}
function pe(e, t) {
	return t === 0 ? [] : e.map((e) => ({
		damage: e.damage,
		probability: e.probability * t
	}));
}
function E(e) {
	return {
		min: e.min * 2,
		max: e.max * 2,
		mean: e.mean * 2,
		outcomes: e.outcomes.map((e) => ({
			damage: e.damage * 2,
			probability: e.probability
		}))
	};
}
function me(e, t) {
	return e.reduce((e, n) => e + (n.damage >= t ? n.probability : 0), 0);
}
function he(e, t) {
	let n = 0;
	for (let [r, i] of e) r >= t && (n += i);
	return n;
}
function ge(e) {
	return Math.max(0, Math.min(1, e));
}
function _e(e) {
	return e < .05 ? "Low" : e < .15 ? "Guarded" : e < .35 ? "Dangerous" : e < .6 ? "Severe" : "Grim";
}
function ve({ downProbability: e, hitDownProbability: t, critDownProbability: n, highestCritChance: r }) {
	return e === 0 ? ["No exact supported hit or crit damage roll in the selected sequence downs the PC."] : t === 0 && n > 0 && n < r ? ["Only some crit damage rolls can down the PC; exact distribution reduces false precision from average damage."] : t === 0 && n > 0 ? [`Down risk is crit-driven; highest strike crit chance is ${Math.round(r * 100)}%.`] : ["Cumulative exact hit and crit damage rolls can down the PC in the modeled sequence."];
}
function ye(e, t) {
	let n = e.mean.toFixed(1);
	return {
		min: e.min,
		max: e.max,
		average: n,
		critMin: t.min,
		critMax: t.max,
		swinginess: be(e, n)
	};
}
function be(e, t) {
	let n = e.max - e.min + 1;
	return n >= e.mean ? `High swing: damage range is ${n} around an average of ${t}.` : `Moderate swing: damage range is ${n} around an average of ${t}.`;
}
//#endregion
//#region src/engine/encounter-risk.ts
var xe = (e) => `${e} has no supported melee Strike with numeric attack bonus and damage formula.`, Se = "Encounter too large to compute pairwise risk safely. Reduce combatants or use the single-pair detail view.";
function Ce(e, t) {
	let { adapter: n, controls: r, pairLimit: i } = t, a = e.hostiles.map((e) => ({
		hostile: e,
		attacks: Te(n, e.token)
	})), o = e.pcs.length * a.reduce((e, t) => e + t.attacks.length, 0);
	if (i !== void 0 && o > i) return {
		pairs: [],
		skipped: !0,
		caveats: [Se]
	};
	let s = [], c = [];
	for (let { hostile: t, attacks: n } of a) {
		if (n.length === 0) {
			c.push(xe(t.snapshot.name));
			continue;
		}
		for (let i of e.pcs) for (let e of n) s.push(we(i.snapshot, t.snapshot, e, r));
	}
	return {
		pairs: s,
		skipped: !1,
		caveats: c
	};
}
function we(e, t, n, r) {
	let i = [];
	try {
		let a = ae({
			hp: e.hp.current + (e.hp.temp ?? 0),
			ac: e.defenses.ac + r.shieldBonus,
			attackBonus: n.attackBonus,
			damageFormula: n.damageFormula,
			strikes: r.strikes,
			mapType: Ee(r.mapMode, n.mapType),
			wounded: De(e, r.woundedOverride),
			doomed: e.deathState?.doomed ?? 0,
			assumeHeroPointAvailable: Oe(e, r.heroPointMode),
			damageType: n.damageType,
			targetAdjustments: e.damageAdjustments
		});
		return {
			pcId: e.id,
			pcName: e.name,
			enemyId: t.id,
			enemyName: t.name,
			attackId: n.id,
			attackName: n.name,
			downProbability: a.downProbability,
			riskLabel: a.riskLabel,
			caveats: i
		};
	} catch (r) {
		return i.push(`Risk could not be computed for this pair: ${r instanceof Error ? r.message : "unknown error"}.`), {
			pcId: e.id,
			pcName: e.name,
			enemyId: t.id,
			enemyName: t.name,
			attackId: n.id,
			attackName: n.name,
			downProbability: 0,
			riskLabel: "Low",
			caveats: i
		};
	}
}
function Te(e, t) {
	try {
		return e.getAttacksFromToken(t);
	} catch {
		return [];
	}
}
function Ee(e, t) {
	return e === "auto" ? t === "unknown" ? "normal" : t : e;
}
function De(e, t) {
	return t === "current" ? e.deathState?.wounded ?? 0 : Number(t);
}
function Oe(e, t) {
	return t === "available" ? !0 : t === "unavailable" ? !1 : (e.deathState?.heroPoints ?? 0) > 0;
}
//#endregion
//#region src/foundry/encounter-participants.ts
var D = "Unknown actor", ke = "No active combat encounter — using scene tokens as a best-effort fallback.", Ae = "No active combat encounter.";
function je(e, t, n = {}) {
	let r = e.combatants ? Array.from(e.combatants) : [];
	return r.length > 0 ? Me(r.map((e) => e.token), t, []) : n.allowSceneFallback && e.sceneTokens ? Me(Array.from(e.sceneTokens), t, [ke]) : {
		pcs: [],
		hostiles: [],
		unsupported: [],
		caveats: [Ae]
	};
}
function Me(e, t, n) {
	let r = [], i = [], a = [], o = [...n];
	for (let n of e) {
		if (!n) {
			a.push(`${D} (no token)`);
			continue;
		}
		let e;
		try {
			e = t.getCombatantFromToken(n);
		} catch {
			a.push(n.name ?? D);
			continue;
		}
		if (!e) {
			a.push(n.name ?? D);
			continue;
		}
		e.disposition === "pc" ? r.push({
			token: n,
			snapshot: e
		}) : e.disposition === "enemy" ? i.push({
			token: n,
			snapshot: e
		}) : o.push(`${e.name} is ${e.disposition} and was excluded from the danger board.`);
	}
	return {
		pcs: r,
		hostiles: i,
		unsupported: a,
		caveats: o
	};
}
function Ne(e, t = {}) {
	let n = game.combat, r = n?.combatants ? Array.from(n.combatants).map((e) => ({ token: Pe(e) })) : void 0, i = canvas.tokens?.placeables;
	return je({
		combatants: r,
		sceneTokens: i
	}, e, t);
}
function Pe(e) {
	let t = e.token;
	if (t) return t.object ?? t;
}
//#endregion
//#region src/systems/pf2e-adapter.ts
var Fe = -1, O = class {
	id = "pf2e";
	label = "Pathfinder Second Edition";
	getCombatantFromToken(e) {
		let t = e.actor;
		if (!t) return null;
		let n = L(t.system), r = L(n.attributes), i = L(r.hp), a = L(r.ac), o = i.value, s = i.max, c = a.value;
		if (!z(o) || !z(s) || !z(c)) return null;
		let l = L(n.saves), u = L(L(n.resources).heroPoints), d = L(n.traits), f = B(L(n.perception).value) ?? B(L(r.perception).value);
		return {
			id: e.id ?? t.id ?? "",
			name: e.name ?? t.name ?? "Unknown Combatant",
			disposition: Xe(e, t),
			hp: {
				current: o,
				max: s,
				temp: B(i.temp)
			},
			defenses: {
				ac: c,
				fort: B(L(l.fortitude).value),
				reflex: B(L(l.reflex).value),
				will: B(L(l.will).value)
			},
			deathState: {
				dying: P(t, "dying"),
				wounded: P(t, "wounded"),
				doomed: P(t, "doomed"),
				heroPoints: B(u.value)
			},
			damageAdjustments: {
				resistances: tt(r.resistances ?? n.resistances),
				weaknesses: tt(r.weaknesses ?? n.weaknesses),
				immunities: nt(r.immunities ?? n.immunities)
			},
			initiativeBonus: f,
			pcCapabilities: t.type === "character" ? He(t) : void 0,
			traits: H(d.value),
			assumptions: []
		};
	}
	getAttacksFromToken(e) {
		let t = e.actor;
		return t ? t.type === "character" ? Ie(t) : F(t).filter((e) => e.type === "melee").map((e) => {
			let t = L(e.system), n = Ze(t), r = Qe(t), i = $e(r);
			if (!z(n) || typeof i != "string") return null;
			let a = H(L(t.traits).value);
			return {
				id: e.id ?? "",
				name: e.name ?? "Unknown Strike",
				attackBonus: n,
				damageFormula: i,
				damageType: et(r),
				traits: a,
				mapType: a.includes("agile") ? "agile" : "normal",
				assumptions: ["PF2e Strike extraction is first-pass and may miss conditional modifiers."]
			};
		}).filter((e) => e !== null) : [];
	}
};
function Ie(e) {
	let t = L(e.system).actions, n = (Array.isArray(t) ? t : []).map((e) => Le(e)).filter((e) => e !== null);
	return n.length > 0 ? n : F(e).filter((e) => e.type === "weapon").filter(Be).map((e) => Ve(e)).filter((e) => e !== null);
}
function Le(e) {
	if (!R(e)) return null;
	let t = V(e.totalModifier) ?? V(e.attackBonus) ?? V(e.mod) ?? V(L(e.attack).totalModifier);
	if (t === void 0) return null;
	let n = Re(e);
	if (!n) return null;
	let r = ze(e), i = H(e.traits), a = L(e.item);
	return {
		id: typeof e.slug == "string" && e.slug || typeof e.id == "string" && e.id || typeof a.id == "string" && a.id || "",
		name: typeof e.label == "string" && e.label || typeof e.name == "string" && e.name || typeof a.name == "string" && a.name || "Unknown Strike",
		attackBonus: t,
		damageFormula: n,
		damageType: r,
		traits: i,
		mapType: i.includes("agile") ? "agile" : "normal",
		assumptions: ["PC Strike extracted from actor.system.actions; conditional modifiers (status, MAP-adjacent feats) may be missing."]
	};
}
function Re(e) {
	if (typeof e.damageFormula == "string") return e.damageFormula;
	if (typeof e.damage == "string") return e.damage;
	if (R(e.damage)) {
		let t = e.damage;
		if (typeof t.formula == "string") return t.formula;
		if (typeof t.damage == "string") return t.damage;
	}
}
function ze(e) {
	if (typeof e.damageType == "string") return e.damageType;
	if (R(e.damage)) {
		let t = e.damage;
		if (typeof t.damageType == "string") return t.damageType;
		if (typeof t.type == "string") return t.type;
	}
}
function Be(e) {
	let t = L(L(e.system).equipped);
	if (t.carryType === "held") return !0;
	let n = V(t.handsHeld);
	return n !== void 0 && n > 0;
}
function Ve(e) {
	let t = L(e.system), n = L(t.damage), r = V(n.dice) ?? 1, i = V(n.die) ?? 6, a = V(n.modifier) ?? 0;
	if (r < 1 || i < 2) return null;
	let o = a > 0 ? `${r}d${i}+${a}` : a < 0 ? `${r}d${i}${a}` : `${r}d${i}`, s = typeof n.damageType == "string" ? n.damageType : typeof n.type == "string" ? n.type : void 0, c = V(L(t.bonus).value) ?? 0, l = H(L(t.traits).value);
	return {
		id: e.id ?? "",
		name: e.name ?? "Unknown Weapon",
		attackBonus: c,
		damageFormula: o,
		damageType: s,
		traits: l,
		mapType: l.includes("agile") ? "agile" : "normal",
		assumptions: ["PC Strike fallback from weapon item: attack bonus excludes character proficiency and ability modifiers."]
	};
}
function He(e) {
	let t = L(L(L(e.system).skills).medicine), n = V(t.totalModifier) ?? V(t.value), r = Ke(V(t.rank)), i = qe(e), { healSpellSlots: a, healCantripLevel: o } = Ue(e);
	return Je() && Ye(e, a, o), n !== void 0 || i || Object.keys(a).length > 0 || o !== null ? {
		medicineModifier: n,
		hasBattleMedicine: i,
		medicineDC: r,
		healSpellSlots: Object.keys(a).length > 0 ? a : void 0,
		healCantripLevel: o
	} : {
		medicineDC: r,
		healCantripLevel: null
	};
}
function Ue(e) {
	let t = A(e, "spell"), n = A(e, "spellcastingEntry"), r = {}, i = null, a = /* @__PURE__ */ new Set(), o = !1;
	for (let n of t) {
		let t = L(n.system);
		if (j(n, t) !== "heal") continue;
		o = !0;
		let r = k(n);
		r && a.add(r), M(t) && (i = V(t.casterLevel) ?? N(e) ?? i ?? 1);
	}
	let s = !1;
	for (let t of n) {
		let n = L(t.system), c = L(n.prepared), l = typeof c.value == "string" ? c.value : void 0, u = L(n.slots);
		for (let [t, n] of Object.entries(u)) {
			let c = Ge(t);
			if (c === void 0) continue;
			let u = L(n), d = We(u.prepared), f = 0;
			for (let e of d) {
				let t = L(e), n = t.id;
				typeof n == "string" && a.has(n) && t.expended !== !0 && (f += 1);
			}
			if (f > 0) {
				s = !0, c === 0 ? i === null && (i = N(e) ?? 1) : r[c] = (r[c] ?? 0) + f;
				continue;
			}
			if (l === "spontaneous" && o && c >= 1) {
				let e = V(u.value);
				e !== void 0 && e > 0 && (r[c] = (r[c] ?? 0) + e, s = !0);
			}
		}
	}
	if (!s) for (let e of t) {
		let t = L(e.system);
		if (j(e, t) !== "heal" || M(t)) continue;
		let n = V(t.level) ?? V(L(t.location).heightenedLevel), i = V(t.slotsRemaining) ?? V(t.uses) ?? 1;
		typeof n == "number" && n >= 1 && i > 0 && (r[n] = (r[n] ?? 0) + i);
	}
	return {
		healSpellSlots: r,
		healCantripLevel: i
	};
}
function We(e) {
	return Array.isArray(e) ? e : typeof e != "object" || !e ? [] : Object.values(e);
}
function k(e) {
	if (typeof e.id == "string" && e.id.length > 0) return e.id;
	let t = e;
	if (typeof t._id == "string" && t._id.length > 0) return t._id;
}
function A(e, t) {
	if (!e) return [];
	let n = L(e.itemTypes)[t];
	return Array.isArray(n) && n.length > 0 ? n.filter(I) : F(e).filter((e) => e.type === t);
}
function j(e, t) {
	return typeof t.slug == "string" ? t.slug : e.name?.toLowerCase().replace(/\s+/g, "-");
}
function Ge(e) {
	let t = e.match(/^slot(\d+)$/);
	if (t) return Number(t[1]);
}
function M(e) {
	return H(L(e.traits).value).includes("cantrip") || e.isCantrip === !0 ? !0 : V(e.level) === 0;
}
function N(e) {
	let t = L(L(e.system).details);
	return V(L(t.level).value) ?? V(t.level);
}
function Ke(e) {
	switch (e) {
		case 4: return 40;
		case 3: return 30;
		case 2: return 20;
		case 1: return 15;
		default: return 15;
	}
}
function qe(e) {
	let t = A(e, "feat");
	for (let e of t) {
		let t = L(e.system);
		if ((typeof t.slug == "string" ? t.slug : e.name?.toLowerCase().replace(/\s+/g, "-")) === "battle-medicine") return !0;
	}
	return !1;
}
function Je() {
	if (typeof game > "u") return !1;
	try {
		return !!(game.settings?.get?.("grim-arithmetic", "debugLogging") ?? !1);
	} catch {
		return !1;
	}
}
function Ye(e, t, n) {
	let r = F(e), i = L(e.itemTypes), a = {};
	for (let e of r) {
		let t = typeof e.type == "string" ? e.type : "(no-type)";
		a[t] = (a[t] ?? 0) + 1;
	}
	let o = Object.keys(i), s = {};
	for (let e of o) {
		let t = i[e];
		Array.isArray(t) && (s[e] = t.length);
	}
	let c = A(e, "spell"), l = A(e, "spellcastingEntry"), u = c.filter((e) => j(e, L(e.system)) === "heal").map((e) => ({
		id: k(e),
		name: e.name,
		slug: L(e.system).slug,
		level: L(e.system).level,
		isCantrip: L(e.system).isCantrip,
		traits: L(L(e.system).traits).value,
		slotsRemaining: L(e.system).slotsRemaining,
		location: L(e.system).location
	})), d = l.map((e) => {
		let t = L(e.system), n = L(t.slots), r = {};
		for (let [e, t] of Object.entries(n)) {
			let n = L(t), i = We(n.prepared);
			r[e] = {
				max: n.max,
				value: n.value,
				preparedCount: i.length,
				preparedSample: i.slice(0, 5).map((e) => L(e))
			};
		}
		return {
			id: k(e),
			name: e.name,
			preparedKind: L(t.prepared).value,
			tradition: L(t.tradition).value,
			slotKeys: Object.keys(n),
			slotSummaries: r
		};
	});
	console.log("Grim Arithmetic | extraction probe", {
		actor: e.name,
		actorType: e.type,
		totalItems: r.length,
		itemTypeCounts: a,
		itemTypesArrayLengths: s,
		healSpells: u,
		spellcastingEntries: d,
		extractedSlots: t,
		extractedCantripLevel: n
	});
}
function Xe(e, t) {
	return t.type === "character" ? "pc" : e.document?.disposition === Fe ? "enemy" : "neutral";
}
function P(e, t) {
	let n = e.itemTypes?.condition?.find((e) => e.slug === t);
	return n ? B(n.value) ?? B(L(L(n.system).value).value) ?? 0 : 0;
}
function F(e) {
	let t = e?.items;
	if (Array.isArray(t)) return t.filter(I);
	let n = L(t).contents;
	if (Array.isArray(n)) return n.filter(I);
	if (R(t) && typeof t.filter == "function") {
		let e = t.filter(I);
		return Array.isArray(e) ? e : [];
	}
	return [];
}
function I(e) {
	return R(e);
}
function Ze(e) {
	return V(L(e.bonus).value) ?? V(L(e.attack).value);
}
function Qe(e) {
	let t = L(e.damageRolls);
	return Object.values(t).find(R);
}
function $e(e) {
	if (!e) return;
	let t = e.damage, n = e.formula;
	if (typeof t == "string") return t;
	if (typeof n == "string") return n;
}
function et(e) {
	if (!e) return;
	let t = e.damageType ?? e.type ?? e.category;
	return typeof t == "string" ? t : void 0;
}
function tt(e) {
	return (Array.isArray(e) ? e : Object.values(L(e))).filter(R).map((e) => {
		let t = e.type ?? e.slug ?? e.label, n = V(e.value) ?? V(e.amount);
		return typeof t != "string" || n === void 0 ? null : {
			type: t,
			value: n
		};
	}).filter((e) => e !== null);
}
function nt(e) {
	return (Array.isArray(e) ? e : Object.values(L(e))).map((e) => {
		if (typeof e == "string") return e;
		let t = L(e), n = t.type ?? t.slug ?? t.label;
		return typeof n == "string" ? n : null;
	}).filter((e) => typeof e == "string");
}
function L(e) {
	return R(e) ? e : {};
}
function R(e) {
	return typeof e == "object" && !!e;
}
function z(e) {
	return typeof e == "number" && Number.isFinite(e);
}
function B(e) {
	return z(e) ? e : void 0;
}
function V(e) {
	if (z(e)) return e;
	if (typeof e != "string") return;
	let t = Number(e.trim().replace(/^\+/, ""));
	return z(t) ? t : void 0;
}
function H(e) {
	return Array.isArray(e) ? e.map((e) => {
		if (typeof e == "string") return e;
		let t = L(e).slug;
		return typeof t == "string" ? t : null;
	}).filter((e) => typeof e == "string") : [];
}
//#endregion
//#region src/ui/danger-board.ts
var rt = 5;
function it(e, t = {}) {
	let n = t.topN ?? rt;
	return {
		topEndangeredPcs: U(e.pairs, (e) => e.pcId).sort((e, t) => t.downProbability - e.downProbability).slice(0, n).map(W),
		topDangerousEnemies: U(e.pairs, (e) => e.enemyId).sort((e, t) => t.downProbability - e.downProbability).slice(0, n).map(W),
		caveats: e.caveats,
		empty: e.pairs.length === 0,
		skipped: e.skipped
	};
}
function U(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let r of e) {
		let e = t(r), i = n.get(e);
		(!i || r.downProbability > i.downProbability) && n.set(e, r);
	}
	return Array.from(n.values());
}
function W(e) {
	let t = Math.round(e.downProbability * 100);
	return {
		pcId: e.pcId,
		enemyId: e.enemyId,
		attackId: e.attackId,
		pcName: e.pcName,
		enemyName: e.enemyName,
		attackName: e.attackName,
		downPercent: t,
		riskLabel: e.riskLabel,
		riskClass: e.riskLabel.toLowerCase(),
		label: `${e.pcName} vs ${e.enemyName} ${e.attackName} — ${t}% ${e.riskLabel}`
	};
}
//#endregion
//#region src/engine/prng.ts
function at(e) {
	let t = typeof e == "string" ? G(e) : K(e), n = () => {
		t = t + 1831565813 >>> 0;
		let e = t;
		return e = Math.imul(e ^ e >>> 15, e | 1), e ^= e + Math.imul(e ^ e >>> 7, e | 61), ((e ^ e >>> 14) >>> 0) / 4294967296;
	};
	return {
		next: n,
		nextInt: (e, t) => {
			if (!Number.isInteger(e) || !Number.isInteger(t)) throw Error(`nextInt bounds must be integers: got ${e}, ${t}`);
			if (e > t) throw Error(`nextInt: min (${e}) must be <= max (${t})`);
			let r = t - e + 1;
			return e + Math.floor(n() * r);
		}
	};
}
function ot(e, t) {
	return st(typeof e == "string" ? G(e) : K(e), typeof t == "string" ? G(t) : K(t));
}
function G(e) {
	let t = 1779033703 ^ e.length;
	for (let n = 0; n < e.length; n += 1) t = Math.imul(t ^ e.charCodeAt(n), 3432918353), t = t << 13 | t >>> 19;
	return t = Math.imul(t ^ t >>> 16, 2246822507), t = Math.imul(t ^ t >>> 13, 3266489909), t ^= t >>> 16, t >>> 0;
}
function K(e) {
	if (!Number.isFinite(e)) throw Error(`Numeric seed must be finite: got ${e}`);
	return Math.floor(Math.abs(e)) >>> 0;
}
function st(e, t) {
	let n = (e ^ Math.imul(t, 2654435761)) >>> 0;
	return n = Math.imul(n ^ n >>> 16, 2246822507), n = Math.imul(n ^ n >>> 13, 3266489909), n ^= n >>> 16, n >>> 0;
}
//#endregion
//#region src/engine/heal-actions.ts
function ct(e, t) {
	switch (e.kind) {
		case "battle-medicine": {
			let n = e.medicineDC ?? 15, r = e.medicineModifier ?? 0, i = t.nextInt(1, 20), a = _({
				die: i,
				total: i + r,
				dc: n
			});
			switch (a) {
				case "criticalSuccess": return {
					healedAmount: q("4d8+8", t),
					degree: a
				};
				case "success": return {
					healedAmount: q("2d8+4", t),
					degree: a
				};
				case "failure": return {
					healedAmount: 0,
					degree: a
				};
				case "criticalFailure": return {
					healedAmount: 0,
					degree: a,
					collateralDamage: q("1d8", t)
				};
			}
			return {
				healedAmount: 0,
				degree: a
			};
		}
		case "heal-spell-1action": return { healedAmount: q("1d10", t) };
		case "heal-spell-2action": {
			let n = Math.max(1, e.spellRank ?? 1);
			return { healedAmount: q(`${n}d8+${n * 8}`, t) };
		}
		case "heal-spell-3action": {
			let n = Math.max(1, e.spellRank ?? 1);
			return { healedAmount: q(`${n}d8+${n * 8}`, t) };
		}
		case "heal-cantrip-1action": return { healedAmount: q("1d10", t) };
		case "heal-cantrip-2action": {
			let n = Math.max(1, e.healerLevel ?? 1);
			return { healedAmount: q(`${1 + Math.ceil(n / 2)}d8`, t) };
		}
	}
}
function lt(e, t, n = {}) {
	if (t <= 0 && !n.clearsDying) return e;
	let r = Math.min(e.hp.max, e.hp.current + Math.max(0, t)), i = {
		...e,
		hp: {
			...e.hp,
			current: r
		}
	};
	return n.clearsDying && i.dying > 0 && (i.dying = 0, r > 0 && (i.downed = !1)), i;
}
function q(e, t) {
	let n = x(e), r = t.next(), i = 0;
	for (let e of n.outcomes) if (i += e.probability, r < i) return e.damage;
	return n.outcomes[n.outcomes.length - 1].damage;
}
//#endregion
//#region src/engine/initiative.ts
function ut(e, t, n = {}) {
	if (n.useFixedOrder) return e.map((e) => ({
		combatantId: e.id,
		side: e.side,
		dieRoll: 0,
		bonus: e.initiativeBonus,
		total: e.initiativeBonus
	}));
	let r = n.pcsWinTies ?? !0, i = e.map((e) => {
		let n = t.nextInt(1, 20);
		return {
			combatantId: e.id,
			side: e.side,
			dieRoll: n,
			bonus: e.initiativeBonus,
			total: n + e.initiativeBonus
		};
	});
	return i.sort((e, t) => t.total === e.total ? e.side === t.side ? e.combatantId < t.combatantId ? -1 : 1 : e.side === "pc" ? r ? -1 : 1 : r ? 1 : -1 : t.total - e.total), i;
}
//#endregion
//#region src/engine/sample-recovery.ts
function dt(e, t) {
	if (e.dying <= 0) return {
		roll: 0,
		degree: "success",
		newDying: 0,
		stabilized: !0
	};
	let n = 10 + e.dying, r = t.nextInt(1, 20), i = _({
		die: r,
		total: r,
		dc: n
	}), a = 0;
	switch (i) {
		case "criticalSuccess":
			a = -2;
			break;
		case "success":
			a = -1;
			break;
		case "failure":
			a = 0;
			break;
		case "criticalFailure":
			a = 1;
			break;
	}
	let o = Math.max(0, e.dying + a);
	return {
		roll: r,
		degree: i,
		newDying: o,
		stabilized: o === 0
	};
}
//#endregion
//#region src/engine/sample-strike.ts
function ft(e, t) {
	let n = t.nextInt(1, 20), r = _({
		die: n,
		total: n + e.attackBonus + e.mapPenalty,
		dc: e.defenderAc
	}), i = 0;
	if (r === "success" || r === "criticalSuccess") {
		let n = x(e.damageFormula), a = oe(e.damageType, e.defenderAdjustments);
		i = pt(S(r === "criticalSuccess" ? E(n) : n, a), t);
	}
	return {
		attackerId: e.attackerId,
		defenderId: e.defenderId,
		attackId: e.attackId,
		attackName: e.attackName,
		degree: r,
		dieRoll: n,
		damage: i
	};
}
function pt(e, t) {
	let n = t.next(), r = 0;
	for (let t of e.outcomes) if (r += t.probability, n < r) return t.damage;
	return e.outcomes[e.outcomes.length - 1].damage;
}
//#endregion
//#region src/engine/sim-state.ts
function mt(e, t) {
	if (e.dead || t.damage <= 0) return {
		combatant: e,
		damageAbsorbed: 0,
		becameDowned: !1,
		becameDead: !1
	};
	let n = e.dying > 0 || e.downed, r = e.downed, i = t.damage, a = e.hp.temp, o = e.hp.current + e.hp.temp;
	if (a > 0) {
		let e = Math.min(a, i);
		a -= e, i -= e;
	}
	let s = Math.max(0, e.hp.current - i), c = {
		...e,
		hp: {
			...e.hp,
			current: s,
			temp: a
		}
	}, l = Math.max(0, o - (s + a));
	if (s > 0) return {
		combatant: c,
		damageAbsorbed: l,
		becameDowned: !1,
		becameDead: !1
	};
	if (e.side === "enemy") return {
		combatant: {
			...c,
			downed: !0,
			dead: !0
		},
		damageAbsorbed: l,
		becameDowned: !r,
		becameDead: !0
	};
	let u = t.degree === "criticalSuccess" ? 2 : 1, d = n ? e.dying + u : u + e.wounded, f = d >= Math.max(1, 4 - e.doomed);
	return f && e.heroPoints > 0 && !e.heroPointSurvivalUsed ? {
		combatant: {
			...c,
			dying: 0,
			downed: !0,
			dead: !1,
			heroPoints: e.heroPoints - 1,
			heroPointSurvivalUsed: !0
		},
		damageAbsorbed: l,
		becameDowned: !r,
		becameDead: !1,
		heroPointSurvivalFired: !0
	} : {
		combatant: {
			...c,
			dying: d,
			downed: !0,
			dead: f
		},
		damageAbsorbed: l,
		becameDowned: !r,
		becameDead: f
	};
}
function ht(e) {
	return Math.max(1, 4 - e.doomed);
}
//#endregion
//#region src/engine/tactics/shared.ts
function gt(e) {
	return !e.downed && !e.dead;
}
function J(e) {
	return e.filter(gt);
}
function _t(e) {
	return e.filter((e) => !e.dead);
}
function vt(e) {
	if (e.attacks.length === 0) return;
	let t = e.attacks[0], n = yt(t.damageFormula);
	for (let r = 1; r < e.attacks.length; r += 1) {
		let i = e.attacks[r], a = yt(i.damageFormula);
		a > n && (n = a, t = i);
	}
	return t;
}
function Y(e) {
	return e.attacks[0];
}
function yt(e) {
	try {
		return x(e).mean;
	} catch {
		return -Infinity;
	}
}
//#endregion
//#region src/engine/tactics/boss-cinematic.ts
var bt = {
	id: "boss-cinematic",
	description: "Use the highest-damage attack on the toughest standing PC, all strikes on the same target.",
	chooseTurn(e) {
		let t = J(e.pcs);
		if (t.length === 0) return { strikes: [] };
		let n = [...t].sort((e, t) => t.hp.current === e.hp.current ? e.id < t.id ? -1 : 1 : t.hp.current - e.hp.current)[0], r = vt(e.attacker) ?? Y(e.attacker);
		if (!r) return { strikes: [] };
		let i = [];
		for (let e = 0; e < 2; e += 1) i.push({
			attackId: r.id,
			targetId: n.id,
			mapIndex: e
		});
		return { strikes: i };
	}
}, xt = {
	id: "focus-fire",
	description: "Concentrate every strike on the standing PC with the lowest current HP.",
	chooseTurn(e) {
		let t = J(e.pcs);
		if (t.length === 0) return { strikes: [] };
		let n = Y(e.attacker);
		if (!n) return { strikes: [] };
		let r = [...t].sort((e, t) => e.hp.current === t.hp.current ? e.id < t.id ? -1 : 1 : e.hp.current - t.hp.current)[0], i = [];
		for (let e = 0; e < 2; e += 1) i.push({
			attackId: n.id,
			targetId: r.id,
			mapIndex: e
		});
		return { strikes: i };
	}
}, St = {
	id: "predator",
	description: "Prioritize wounded > low-HP > full-HP PCs; attack downed only if no standing PCs remain.",
	chooseTurn(e) {
		let t = J(e.pcs), n;
		if (n = t.length > 0 ? [...t].sort(Ct) : _t(e.pcs), n.length === 0) return { strikes: [] };
		let r = Y(e.attacker);
		if (!r) return { strikes: [] };
		let i = n[0], a = [];
		for (let e = 0; e < 2; e += 1) a.push({
			attackId: r.id,
			targetId: i.id,
			mapIndex: e
		});
		return { strikes: a };
	}
};
function Ct(e, t) {
	return t.wounded === e.wounded ? e.hp.current === t.hp.current ? e.id < t.id ? -1 : 1 : e.hp.current - t.hp.current : t.wounded - e.wounded;
}
//#endregion
//#region src/engine/tactics/index.ts
var wt = {
	"random-legal": {
		id: "random-legal",
		description: "Pick any legal PC target and any attack, independently per strike.",
		chooseTurn(e, t) {
			let n = J(e.pcs);
			if (n.length === 0 || e.attacker.attacks.length === 0) return { strikes: [] };
			let r = [];
			for (let i = 0; i < 2; i += 1) {
				let a = n[t.nextInt(0, n.length - 1)], o = e.attacker.attacks[t.nextInt(0, e.attacker.attacks.length - 1)];
				r.push({
					attackId: o.id,
					targetId: a.id,
					mapIndex: i
				});
			}
			return { strikes: r };
		}
	},
	"spread-damage": {
		id: "spread-damage",
		description: "Distribute strikes across higher-HP standing PCs; never target downed.",
		chooseTurn(e) {
			let t = J(e.pcs);
			if (t.length === 0) return { strikes: [] };
			let n = Y(e.attacker);
			if (!n) return { strikes: [] };
			let r = [...t].sort((e, t) => t.hp.current === e.hp.current ? e.id < t.id ? -1 : 1 : t.hp.current - e.hp.current), i = [];
			for (let e = 0; e < 2; e += 1) {
				let t = r[e % r.length];
				i.push({
					attackId: n.id,
					targetId: t.id,
					mapIndex: e
				});
			}
			return { strikes: i };
		}
	},
	"focus-fire": xt,
	predator: St,
	"boss-cinematic": bt
}, Tt = {
	id: "random-legal",
	description: "PCs heal dying or low-HP allies when capable; otherwise 2 Strikes against the most-dangerous standing enemy.",
	chooseTurn(e) {
		let t = e.enemies.filter((e) => !e.downed && !e.dead), n = e.attacker, r = Dt(e.pcs);
		if (r && Et(n.healing)) {
			let e = kt(n, r, "emergency");
			if (e) return {
				strikes: [],
				heal: e
			};
		}
		let i = Ot(e.pcs, n);
		if (i && Et(n.healing)) {
			let e = kt(n, i, "topup");
			if (e) {
				let r = Y(n);
				if (r && t.length > 0) {
					let n = [...t].sort(jt)[0];
					return {
						strikes: [{
							attackId: r.id,
							targetId: n.id,
							mapIndex: 0
						}],
						heal: e
					};
				}
				return {
					strikes: [],
					heal: e
				};
			}
		}
		if (t.length === 0) return { strikes: [] };
		let a = Y(n);
		if (!a) return { strikes: [] };
		let o = [...t].sort(jt)[0], s = [];
		for (let e = 0; e < 2; e += 1) s.push({
			attackId: a.id,
			targetId: o.id,
			mapIndex: e
		});
		return { strikes: s };
	}
};
function Et(e) {
	return e ? Object.values(e.healSpellSlotsRemaining).some((e) => e > 0) || e.healCantripLevel !== null || e.hasBattleMedicine : !1;
}
function Dt(e) {
	let t = e.filter((e) => e.dying > 0 && !e.dead);
	if (t.length !== 0) return [...t].sort((e, t) => t.dying === e.dying ? e.id < t.id ? -1 : 1 : t.dying - e.dying)[0];
}
function Ot(e, t) {
	let n = e.filter((e) => !e.downed && !e.dead && e.dying === 0 && e.hp.current < e.hp.max * .4);
	if (n.length !== 0) return [...n].sort((e, n) => {
		let r = +(e.id === t.id), i = +(n.id === t.id);
		if (r !== i) return r - i;
		let a = e.hp.current / e.hp.max, o = n.hp.current / n.hp.max;
		return a === o ? e.id < n.id ? -1 : 1 : a - o;
	})[0];
}
function kt(e, t, n) {
	let r = e.healing;
	if (!r) return;
	let i = n === "emergency" ? [
		"heal-spell-2action",
		"heal-cantrip-2action",
		"heal-spell-1action",
		"heal-cantrip-1action",
		"battle-medicine"
	] : [
		"heal-spell-1action",
		"heal-cantrip-1action",
		"heal-spell-2action",
		"heal-cantrip-2action",
		"battle-medicine"
	];
	for (let n of i) {
		if (n === "heal-spell-2action" || n === "heal-spell-1action" || n === "heal-spell-3action") {
			let i = At(r.healSpellSlotsRemaining);
			if (i !== void 0) return {
				kind: n,
				healerId: e.id,
				targetId: t.id,
				spellRank: i
			};
			continue;
		}
		if (n === "heal-cantrip-2action" || n === "heal-cantrip-1action") {
			if (r.healCantripLevel !== null) return {
				kind: n,
				healerId: e.id,
				targetId: t.id
			};
			continue;
		}
		if (n === "battle-medicine") {
			if (r.hasBattleMedicine && !r.battleMedicineUsedTargets.has(t.id)) return {
				kind: n,
				healerId: e.id,
				targetId: t.id
			};
			continue;
		}
	}
}
function At(e) {
	return Object.keys(e).map((e) => Number(e)).filter((t) => e[t] > 0).sort((e, t) => e - t)[0];
}
function jt(e, t) {
	let n = Mt(e), r = Mt(t);
	return n === r ? e.hp.current === t.hp.current ? e.id < t.id ? -1 : 1 : e.hp.current - t.hp.current : r - n;
}
function Mt(e) {
	let t = 0;
	for (let n of e.attacks) try {
		let e = x(n.damageFormula).mean;
		e > t && (t = e);
	} catch {}
	return t;
}
//#endregion
//#region src/engine/run-iteration.ts
function Nt(e, t, n, r = 0, i = {}) {
	let a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Map();
	for (let t of e.pcs) a.set(t.id, It(t)), o.set(t.id, t.hp.current + t.hp.temp);
	for (let t of e.enemies) a.set(t.id, It(t)), o.set(t.id, t.hp.current + t.hp.temp);
	let s = ut(Array.from(a.values()), n, { useFixedOrder: i.useFixedInitiative }), c = wt[t.tacticsProfile], l = Tt, u = {}, d = [], f = null, p = 0, m = 0, h = 0, g = 0;
	for (let e = 1; e <= t.maxRounds; e += 1) {
		p = e;
		for (let r of s) {
			let i = a.get(r.combatantId);
			if (!i || i.dead) continue;
			if (i.side === "pc" && i.dying > 0) {
				let e = dt(i, n);
				m += 1;
				let t = ht(i), r = {
					...i,
					dying: e.newDying,
					downed: e.newDying > 0 || i.hp.current === 0,
					dead: e.newDying >= t
				};
				a.set(i.id, r);
				continue;
			}
			if (i.downed) continue;
			let o = Lt(a, "pc"), s = Lt(a, "enemy"), p = (i.side === "pc" ? l : c).chooseTurn({
				attacker: i,
				pcs: o,
				enemies: s,
				round: e
			}, n);
			if (p.heal) {
				let e = a.get(p.heal.targetId);
				if (e && !e.dead) {
					let t = ct({
						kind: p.heal.kind,
						healerLevel: i.healing?.healCantripLevel ?? void 0,
						spellRank: p.heal.spellRank,
						medicineModifier: i.healing?.medicineModifier,
						medicineDC: i.healing?.medicineDC
					}, n), r = p.heal.kind.startsWith("heal-spell") && e.dying > 0, o = lt(e, t.healedAmount, { clearsDying: r });
					if (t.collateralDamage && t.collateralDamage > 0 && (o = mt(o, {
						damage: t.collateralDamage,
						degree: "success"
					}).combatant), a.set(e.id, o), g += 1, p.heal.kind.startsWith("heal-spell") && p.heal.spellRank !== void 0) {
						let e = Pt(i, p.heal.spellRank);
						a.set(i.id, e);
					} else if (p.heal.kind === "battle-medicine") {
						let t = Ft(i, e.id);
						a.set(i.id, t);
					}
				}
			}
			if (p.strikes.length !== 0) for (let r of p.strikes) {
				let o = a.get(r.targetId), s = i.attacks.find((e) => e.id === r.attackId);
				if (!o || o.dead || !s) continue;
				let c = de(s.mapType === "unknown" ? "normal" : s.mapType)[r.mapIndex] ?? 0, l = ft({
					attackerId: i.id,
					defenderId: o.id,
					attackId: s.id,
					attackName: s.name,
					attackBonus: s.attackBonus,
					mapPenalty: c,
					defenderAc: o.defenses.ac,
					damageFormula: s.damageFormula,
					damageType: s.damageType,
					defenderAdjustments: o.damageAdjustments
				}, n), p = mt(o, {
					damage: l.damage,
					degree: l.degree
				});
				if (a.set(o.id, p.combatant), p.damageAbsorbed > 0) {
					let e = `${i.id}->${o.id}`;
					u[e] = (u[e] ?? 0) + p.damageAbsorbed;
				}
				p.becameDowned && o.side === "pc" && f === null && (f = e), p.heroPointSurvivalFired && (h += 1), t.captureEvents && d.push({
					round: e,
					attackerId: i.id,
					defenderId: o.id,
					attackId: s.id,
					attackName: s.name,
					degree: l.degree,
					damage: p.damageAbsorbed,
					causedDown: p.becameDowned
				});
			}
		}
		if (Rt(a) || zt(a)) break;
	}
	let _ = Array.from(a.values()).map((e) => ({
		id: e.id,
		side: e.side,
		endingHp: e.hp.current,
		dying: e.dying,
		wounded: e.wounded,
		doomed: e.doomed,
		downed: e.downed,
		dead: e.dead,
		damageTaken: Math.max(0, (o.get(e.id) ?? 0) - (e.hp.current + e.hp.temp))
	})), v = Bt(a);
	return {
		iterationIndex: r,
		roundsElapsed: p,
		firstDownRound: f,
		tpk: v,
		perCombatant: _,
		damageByPair: u,
		events: t.captureEvents ? d : void 0,
		healsFired: g,
		recoveryChecksFired: m,
		heroPointSurvivalsFired: h
	};
}
function Pt(e, t) {
	if (!e.healing) return e;
	let n = e.healing.healSpellSlotsRemaining[t] ?? 0;
	if (n <= 0) return e;
	let r = { ...e.healing.healSpellSlotsRemaining };
	return r[t] = n - 1, {
		...e,
		healing: {
			...e.healing,
			healSpellSlotsRemaining: r
		}
	};
}
function Ft(e, t) {
	if (!e.healing) return e;
	let n = new Set(e.healing.battleMedicineUsedTargets);
	return n.add(t), {
		...e,
		healing: {
			...e.healing,
			battleMedicineUsedTargets: n
		}
	};
}
function It(e) {
	return {
		...e,
		hp: { ...e.hp },
		defenses: { ...e.defenses }
	};
}
function Lt(e, t) {
	let n = [];
	for (let r of e.values()) r.side === t && n.push(r);
	return n;
}
function Rt(e) {
	let t = 0;
	for (let n of e.values()) if (n.side === "pc" && (t += 1, !n.downed && !n.dead)) return !1;
	return t > 0;
}
function zt(e) {
	let t = 0;
	for (let n of e.values()) if (n.side === "enemy" && (t += 1, !n.dead)) return !1;
	return t > 0;
}
function Bt(e) {
	return Rt(e);
}
//#endregion
//#region src/engine/simulation-types.ts
var Vt = 1e4, Ht = class extends Error {
	requested;
	cap;
	constructor(e) {
		super(`Iterations ${e} exceeds engine cap ${Vt}`), this.name = "MaxIterationsExceededError", this.requested = e, this.cap = Vt;
	}
};
function Ut(e) {
	if (!Number.isInteger(e.iterations) || e.iterations < 1) throw Error(`iterations must be a positive integer, got ${e.iterations}`);
	if (e.iterations > 1e4) throw new Ht(e.iterations);
	if (!Number.isInteger(e.maxRounds) || e.maxRounds < 1) throw Error(`maxRounds must be a positive integer, got ${e.maxRounds}`);
	if (e.wallClockBudgetMs !== void 0 && (!Number.isFinite(e.wallClockBudgetMs) || e.wallClockBudgetMs < 0)) throw Error(`wallClockBudgetMs must be a non-negative finite number, got ${e.wallClockBudgetMs}`);
}
//#endregion
//#region src/engine/run-simulation.ts
function Wt(e, t, n = {}) {
	Ut(t);
	let r = t.seed ?? Date.now(), i = t.wallClockBudgetMs ?? 0, a = i > 0 ? Date.now() : 0, o = [], s = !1;
	for (let c = 0; c < t.iterations; c += 1) {
		if (n.abortSignal?.aborted) {
			s = !0;
			break;
		}
		if (i > 0 && Date.now() - a > i) {
			s = !0;
			break;
		}
		let l = ot(r, c);
		o.push(Nt(e, t, at(l), c)), n.onProgress?.(c + 1, t.iterations);
	}
	return Gt(e, t, r, o, s);
}
function Gt(e, t, n, r, i) {
	let a = r.length;
	if (a === 0) return {
		iterationsRequested: t.iterations,
		iterationsCompleted: 0,
		seed: n,
		tacticsProfile: t.tacticsProfile,
		aborted: i,
		anyPcDownProbability: 0,
		tpkProbability: 0,
		meanFirstDownRound: null,
		medianFirstDownRound: null,
		perPc: e.pcs.map((e) => ({
			id: e.id,
			name: e.name,
			downProbability: 0,
			deathProbability: 0,
			meanEndingHp: e.hp.current,
			topContributingEnemyId: null
		})),
		perEnemy: e.enemies.map((e) => ({
			id: e.id,
			name: e.name,
			damageShare: 0,
			topTargetId: null
		})),
		safetyNet: {
			meanHealsPerIteration: 0,
			meanRecoveryChecksPerIteration: 0,
			heroPointSurvivalRate: 0
		},
		caveats: [...e.caveats, "No iterations completed."]
	};
	let o = 0, s = 0, c = [], l = /* @__PURE__ */ new Map(), u = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map(), f = /* @__PURE__ */ new Map();
	for (let e of r) {
		let t = !1, n = !0, r = 0;
		for (let i of e.perCombatant) {
			if (i.side !== "pc") continue;
			r += 1, i.downed || i.dead ? (t = !0, l.set(i.id, (l.get(i.id) ?? 0) + 1)) : n = !1, i.dead && u.set(i.id, (u.get(i.id) ?? 0) + 1);
			let e = d.get(i.id) ?? [];
			e.push(i.endingHp), d.set(i.id, e);
		}
		r > 0 && t && (o += 1), r > 0 && n && (s += 1), e.firstDownRound !== null && c.push(e.firstDownRound);
		for (let [t, n] of Object.entries(e.damageByPair)) f.set(t, (f.get(t) ?? 0) + n);
	}
	let p = e.pcs.map((t) => {
		let n = l.get(t.id) ?? 0, r = u.get(t.id) ?? 0, i = d.get(t.id) ?? [], o = i.length > 0 ? i.reduce((e, t) => e + t, 0) / i.length : t.hp.current, s = null, c = 0;
		for (let n of e.enemies) {
			let e = f.get(`${n.id}->${t.id}`) ?? 0;
			e > c && (c = e, s = n.id);
		}
		return {
			id: t.id,
			name: t.name,
			downProbability: n / a,
			deathProbability: r / a,
			meanEndingHp: o,
			topContributingEnemyId: s
		};
	}), m = 0;
	for (let e of f.values()) m += e;
	let h = e.enemies.map((t) => {
		let n = 0, r = null, i = 0;
		for (let a of e.pcs) {
			let e = f.get(`${t.id}->${a.id}`) ?? 0;
			n += e, e > i && (i = e, r = a.id);
		}
		return {
			id: t.id,
			name: t.name,
			damageShare: m > 0 ? n / m : 0,
			topTargetId: r
		};
	}), g = 0, _ = 0, v = 0;
	for (let e of r) g += e.healsFired, _ += e.recoveryChecksFired, e.heroPointSurvivalsFired > 0 && (v += 1);
	let ee = o / a, y = s / a, b = c.length > 0 ? c.reduce((e, t) => e + t, 0) / c.length : null, x = Jt(o, a, s, c);
	return {
		iterationsRequested: t.iterations,
		iterationsCompleted: a,
		seed: n,
		tacticsProfile: t.tacticsProfile,
		aborted: i,
		anyPcDownProbability: ee,
		tpkProbability: y,
		meanFirstDownRound: b,
		medianFirstDownRound: c.length > 0 ? Kt(c) : null,
		perPc: p,
		perEnemy: h,
		safetyNet: {
			meanHealsPerIteration: g / a,
			meanRecoveryChecksPerIteration: _ / a,
			heroPointSurvivalRate: v / a
		},
		confidenceIntervals: x,
		caveats: [...e.caveats]
	};
}
function Kt(e) {
	let t = [...e].sort((e, t) => e - t), n = Math.floor(t.length / 2);
	return t.length % 2 == 0 ? (t[n - 1] + t[n]) / 2 : t[n];
}
var qt = 1.959963984540054;
function Jt(e, t, n, r) {
	let i = Yt(e, t), a = Yt(n, t), o = null;
	return r.length > 0 && (o = Xt(r)), {
		anyPcDown: i,
		tpk: a,
		meanFirstDownRound: o
	};
}
function Yt(e, t) {
	if (t === 0) return {
		lower: 0,
		upper: 0
	};
	let n = e / t, r = qt * Math.sqrt(n * (1 - n) / t);
	return {
		lower: Zt(n - r),
		upper: Zt(n + r)
	};
}
function Xt(e) {
	let t = e.length;
	if (t === 0) return {
		lower: 0,
		upper: 0
	};
	let n = e.reduce((e, t) => e + t, 0) / t, r = e.reduce((e, t) => e + (t - n) ** 2, 0) / t, i = qt * Math.sqrt(r / t);
	return {
		lower: n - i,
		upper: n + i
	};
}
function Zt(e) {
	return Math.max(0, Math.min(1, e));
}
//#endregion
//#region src/engine/run-simulation-in-worker.ts
var Qt = class extends Error {
	constructor() {
		super("Monte Carlo encounter simulation is disabled in module settings."), this.name = "MonteCarloDisabledError";
	}
};
function $t(e, t, n = {}) {
	return h() ? typeof Worker > "u" ? en(e, t, n) : tn(e, t, n) : {
		promise: Promise.reject(new Qt()),
		cancel: () => {}
	};
}
function en(e, t, n) {
	let r = { aborted: !1 };
	return {
		promise: Promise.resolve().then(() => Wt(e, t, {
			onProgress: n.onProgress,
			abortSignal: r
		})),
		cancel: () => {
			r.aborted = !0;
		}
	};
}
function tn(e, t, n) {
	let r = new Worker(new URL(
		/* @vite-ignore */
		"" + new URL("assets/simulation.worker-ChHnUOCM.js", import.meta.url).href,
		"" + import.meta.url
	), { type: "module" }), i = !1, a = !1;
	return {
		promise: new Promise((i, o) => {
			let s = (e) => {
				let t = e.data;
				if (!(!t || typeof t != "object")) switch (t.type) {
					case "progress":
						n.onProgress?.(t.completed, t.total);
						break;
					case "result":
						l(() => i(t.result));
						break;
					case "error":
						l(() => o(Error(t.message)));
						break;
				}
			}, c = (e) => {
				l(() => o(Error(e.message || "Worker error")));
			}, l = (e) => {
				if (!a) {
					a = !0, r.removeEventListener("message", s), r.removeEventListener("error", c);
					try {
						e();
					} finally {
						r.terminate();
					}
				}
			};
			r.addEventListener("message", s), r.addEventListener("error", c);
			let u = {
				type: "run",
				setup: e,
				config: t
			};
			r.postMessage(u);
		}),
		cancel: () => {
			i || a || (i = !0, r.postMessage({ type: "abort" }));
		}
	};
}
//#endregion
//#region src/foundry/encounter-setup.ts
function nn(e, t = {}) {
	return rn(Ne(e, { allowSceneFallback: t.allowSceneFallback }), e);
}
function rn(e, t) {
	let n = [...e.caveats];
	for (let t of e.unsupported) n.push(`Unsupported actor skipped: ${t}`);
	let r = on();
	return {
		pcs: e.pcs.map((e) => {
			let i = [];
			try {
				i = t.getAttacksFromToken(e.token);
			} catch {
				n.push(`${e.snapshot.name}: PC attack extraction failed; treated as no supported Strike.`);
			}
			i.length === 0 && n.push(`${e.snapshot.name} has no supported Strike; will skip its turns in the simulation.`);
			let a = cn(e.snapshot, "pc", i, n);
			return a.healing = an(e.snapshot, n), r && sn(e.snapshot, a.healing), a;
		}),
		enemies: e.hostiles.map((e) => {
			let r = [];
			try {
				r = t.getAttacksFromToken(e.token);
			} catch {
				n.push(`${e.snapshot.name}: attack extraction failed; treated as no supported attacks.`);
			}
			return r.length === 0 && n.push(`${e.snapshot.name} has no supported attacks; will skip its turns.`), cn(e.snapshot, "enemy", r, n);
		}),
		caveats: n
	};
}
function an(e, t) {
	let n = e.pcCapabilities;
	if (!n) return {
		medicineDC: 15,
		hasBattleMedicine: !1,
		battleMedicineUsedTargets: /* @__PURE__ */ new Set(),
		healSpellSlotsRemaining: {},
		healCantripLevel: null
	};
	let r = n.hasBattleMedicine === !0, i = n.healSpellSlots ?? {}, a = n.healCantripLevel ?? null, o = Object.values(i).reduce((e, t) => e + t, 0);
	return !r && o === 0 && a === null ? t.push(`${e.name} has no healing options; will not heal in this simulation.`) : r && o === 0 && a === null && n.medicineModifier === void 0 && t.push(`${e.name}: Battle Medicine detected but no Medicine modifier; using default DC 15 with +0 modifier.`), {
		medicineModifier: n.medicineModifier,
		medicineDC: n.medicineDC ?? 15,
		hasBattleMedicine: r,
		battleMedicineUsedTargets: /* @__PURE__ */ new Set(),
		healSpellSlotsRemaining: { ...i },
		healCantripLevel: a
	};
}
function on() {
	if (typeof game > "u") return !1;
	try {
		return !!(game.settings?.get?.("grim-arithmetic", "debugLogging") ?? !1);
	} catch {
		return !1;
	}
}
function sn(e, t) {
	let n = Object.entries(t.healSpellSlotsRemaining).map(([e, t]) => `rank ${e}: ${t}`).join(", ");
	console.log("Grim Arithmetic | PC healing capability", {
		name: e.name,
		hasBattleMedicine: t.hasBattleMedicine,
		medicineModifier: t.medicineModifier,
		medicineDC: t.medicineDC,
		healCantripLevel: t.healCantripLevel,
		healSpellSlots: n || "(none)"
	});
}
function cn(e, t, n, r) {
	return e.initiativeBonus === void 0 && r.push(`${e.name}: initiative bonus unknown; defaulting to 0.`), {
		id: e.id,
		name: e.name,
		side: t,
		hp: {
			current: e.hp.current,
			max: e.hp.max,
			temp: e.hp.temp ?? 0
		},
		defenses: {
			ac: e.defenses.ac,
			fort: e.defenses.fort,
			reflex: e.defenses.reflex,
			will: e.defenses.will
		},
		heroPointSurvivalUsed: !1,
		dying: e.deathState?.dying ?? 0,
		wounded: e.deathState?.wounded ?? 0,
		doomed: e.deathState?.doomed ?? 0,
		heroPoints: e.deathState?.heroPoints ?? 0,
		downed: (e.deathState?.dying ?? 0) > 0,
		dead: !1,
		initiativeBonus: e.initiativeBonus ?? 0,
		damageAdjustments: e.damageAdjustments,
		traits: [...e.traits],
		attacks: [...n]
	};
}
//#endregion
//#region src/ui/panel-data.ts
var ln = {
	strikes: 2,
	mapMode: "auto",
	shieldBonus: 0,
	woundedOverride: "current",
	heroPointMode: "actor",
	attackId: ""
}, X = "Permanent death probability is planned for a future milestone and is not modeled in MVP.";
function un({ selection: e, adapter: t, controls: n, moduleVersion: r }) {
	if (e.errors.length > 0 || !e.subjectToken || !e.enemyToken) return {
		moduleVersion: r,
		message: "Select one PC token and target one enemy token to estimate immediate down risk.",
		permanentDeath: X,
		errors: e.errors,
		controls: dn(n, [])
	};
	let i = t.getCombatantFromToken(e.subjectToken), a = t.getCombatantFromToken(e.enemyToken), o = t.getAttacksFromToken(e.enemyToken), s = pn(o, n.attackId), c = fn(i, a, s), l = dn(n, o, s?.id);
	if (c.length > 0 || !i || !a || !s) return {
		moduleVersion: r,
		message: "Grim Arithmetic could not extract enough PF2e data for this token pair yet.",
		permanentDeath: X,
		errors: c,
		controls: l
	};
	let u = mn(n.mapMode, s.mapType), d = i.defenses.ac + n.shieldBonus, f = i.hp.current + (i.hp.temp ?? 0), p = gn(i, n.woundedOverride), m = i.deathState?.doomed ?? 0, h = _n(i, n.heroPointMode), g = ae({
		hp: f,
		ac: d,
		attackBonus: s.attackBonus,
		damageFormula: s.damageFormula,
		strikes: n.strikes,
		mapType: u,
		wounded: p,
		doomed: m,
		assumeHeroPointAvailable: h,
		damageType: s.damageType,
		targetAdjustments: i.damageAdjustments
	}), _ = [...s.assumptions, ...g.assumptions];
	return n.shieldBonus > 0 && _.push(`Applies a +${n.shieldBonus} shield/status AC adjustment.`), n.woundedOverride !== "current" && _.push(`Uses wounded override ${n.woundedOverride} for dying severity if the PC is downed.`), n.heroPointMode !== "actor" && _.push(`Uses Hero Point override: ${n.heroPointMode}.`), {
		moduleVersion: r,
		message: "Immediate down-risk estimate based on the selected PC and targeted enemy.",
		permanentDeath: X,
		errors: [],
		controls: l,
		subject: i,
		enemy: a,
		attack: s,
		risk: {
			downPercent: Z(g.downProbability),
			expectedHpAfterTurn: g.expectedHpAfterTurn.toFixed(1),
			riskLabel: g.riskLabel,
			effectiveAc: d,
			modeledHp: f,
			woundedNote: hn(i, n.woundedOverride),
			damage: g.damage,
			damageAdjustment: g.damageAdjustment,
			dyingSeverity: g.dyingSeverity,
			strikeChances: g.hitChanceByStrike.map((e, t) => ({
				index: t + 1,
				hitPercent: Z(e),
				critPercent: Z(g.critChanceByStrike[t] ?? 0)
			})),
			assumptions: _,
			notModeled: g.notModeled
		}
	};
}
function dn(e, t, n = e.attackId) {
	let r = t.some((e) => e.id === n) ? n : t[0]?.id ?? "";
	return {
		strikes: [
			"1",
			"2",
			"3"
		].map((t) => ({
			value: t,
			label: `${t} Strike${t === "1" ? "" : "s"}`,
			selected: String(e.strikes) === t
		})),
		attacks: t.map((e) => ({
			value: e.id,
			label: `${e.name} — +${e.attackBonus}, ${e.damageFormula}`,
			selected: e.id === r
		})),
		mapMode: [
			["auto", "Auto"],
			["normal", "Normal"],
			["agile", "Agile"],
			["none", "None"]
		].map(([t, n]) => ({
			value: t,
			label: n,
			selected: e.mapMode === t
		})),
		shieldBonus: [
			"0",
			"1",
			"2"
		].map((t) => ({
			value: t,
			label: t === "0" ? "No shield bonus" : `+${t} AC`,
			selected: String(e.shieldBonus) === t
		})),
		woundedOverride: [
			"current",
			"0",
			"1",
			"2",
			"3"
		].map((t) => ({
			value: t,
			label: t === "current" ? "Current actor value" : `Wounded ${t}`,
			selected: e.woundedOverride === t
		})),
		heroPointMode: [
			["actor", "Use actor Hero Points"],
			["available", "Assume Hero Point available"],
			["unavailable", "Assume no Hero Point"]
		].map(([t, n]) => ({
			value: t,
			label: n,
			selected: e.heroPointMode === t
		}))
	};
}
function fn(e, t, n) {
	let r = [];
	return e || r.push("Could not read selected PC HP/AC from PF2e actor data."), t || r.push("Could not read targeted enemy HP/AC from PF2e actor data."), e && e.disposition !== "pc" && r.push("Selected token is not recognized as a PC/character by the PF2e adapter."), t && t.disposition !== "enemy" && r.push("Targeted token is not recognized as an enemy/NPC by the PF2e adapter."), n || r.push("Targeted enemy has no supported melee Strike with a numeric attack bonus and supported damage formula."), r;
}
function pn(e, t) {
	return e.find((e) => e.id === t) ?? e[0];
}
function mn(e, t) {
	return e === "auto" ? t === "unknown" ? "normal" : t : e;
}
function hn(e, t) {
	return t === "current" ? `Current actor wounded value used for dying severity: ${e.deathState?.wounded ?? 0}` : `Override used for dying severity: Wounded ${t}`;
}
function gn(e, t) {
	return t === "current" ? e.deathState?.wounded ?? 0 : Number(t);
}
function _n(e, t) {
	return t === "available" ? !0 : t === "unavailable" ? !1 : (e.deathState?.heroPoints ?? 0) > 0;
}
function Z(e) {
	return Math.round(e * 100);
}
var vn = { tacticsProfile: "spread-damage" }, Q = {
	"random-legal": "Random legal",
	"spread-damage": "Spread damage",
	"focus-fire": "Focus fire",
	predator: "Predator",
	"boss-cinematic": "Boss cinematic"
}, yn = {
	"random-legal": "Enemies pick any legal PC target and any attack independently per strike.",
	"spread-damage": "Enemies spread strikes across higher-HP standing PCs; never target downed.",
	"focus-fire": "Enemies concentrate every strike on the lowest-HP standing PC.",
	predator: "Enemies prioritize wounded > low-HP > full-HP PCs; attack downed only as a last resort.",
	"boss-cinematic": "Enemy uses the highest-damage attack on the toughest standing PC, all strikes on the same target."
};
function bn({ moduleVersion: e, enabled: t, controls: n, state: r }) {
	let i = [
		"PCs Strike the most-dangerous standing enemy (2 strikes per turn by default).",
		"PCs with healing capability substitute Strikes for Heal spells / Battle Medicine when allies are dying or below 40% HP.",
		"Dying PCs roll PF2e recovery checks each turn (DC 10+dying); crit-success / success / crit-failure step dying.",
		"Hero Points are spent to prevent death (once per iteration per PC).",
		"Not modeled: reactions (Shield Block, Champion), spells beyond Heal, persistent damage, attacks of opportunity, movement / reach / line of sight."
	];
	if (!t) return {
		moduleVersion: e,
		enabled: !1,
		disabledMessage: "Monte Carlo simulation is disabled in Grim Arithmetic module settings. Enable it in Configure Settings to run forecasts on this client.",
		message: "",
		state: "idle",
		controls: Sn(n),
		assumptions: i
	};
	let a = Sn(n);
	if (r.kind === "idle") return {
		moduleVersion: e,
		enabled: !0,
		disabledMessage: "",
		message: "Select a tactics profile and click Forecast to simulate the active encounter.",
		state: "idle",
		controls: a,
		assumptions: i
	};
	if (r.kind === "running") return {
		moduleVersion: e,
		enabled: !0,
		disabledMessage: "",
		message: "Simulation in progress…",
		state: "running",
		controls: a,
		progress: {
			completed: r.completed,
			total: r.total,
			percent: r.total > 0 ? Math.round(r.completed / r.total * 100) : 0
		},
		assumptions: i
	};
	if (r.kind === "error") return {
		moduleVersion: e,
		enabled: !0,
		disabledMessage: "",
		message: "Forecast failed.",
		state: "error",
		controls: a,
		errorMessage: r.message,
		assumptions: i
	};
	let o = r.result;
	return {
		moduleVersion: e,
		enabled: !0,
		disabledMessage: "",
		message: o.aborted ? "Forecast aborted." : "Forecast complete.",
		state: "done",
		controls: a,
		result: Cn(o),
		pessimismWarning: xn(o),
		assumptions: [...i, ...o.caveats.map((e) => `Setup: ${e}`)]
	};
}
function xn(e) {
	if (!(e.anyPcDownProbability < .8)) return "High-risk encounter. Even with PCs healing, recovering, and spending Hero Points, the modeled outcome ends badly in most iterations. Reactions (Shield Block, Champion) and tactical positioning are still not modeled, so real-table risk may be a bit lower — but this encounter has structural lethality worth examining.";
}
function Sn(e) {
	return { tacticsProfile: Object.keys(Q).sort().map((t) => ({
		value: t,
		label: Q[t],
		selected: e.tacticsProfile === t
	})) };
}
function Cn(e) {
	let t = new Map(e.perPc.map((e) => [e.id, e.name])), n = new Map(e.perEnemy.map((e) => [e.id, e.name])), r = e.confidenceIntervals, i = Math.round(e.anyPcDownProbability * 100), a = Math.round(e.tpkProbability * 100), o = r?.anyPcDown ? `${Math.round(r.anyPcDown.lower * 100)}%–${Math.round(r.anyPcDown.upper * 100)}%` : null, s = r?.tpk ? `${Math.round(r.tpk.lower * 100)}%–${Math.round(r.tpk.upper * 100)}%` : null, c = r?.meanFirstDownRound ? `${r.meanFirstDownRound.lower.toFixed(1)}–${r.meanFirstDownRound.upper.toFixed(1)}` : null;
	return {
		iterationsCompleted: e.iterationsCompleted,
		iterationsRequested: e.iterationsRequested,
		tacticsProfileLabel: Q[e.tacticsProfile],
		tacticsProfileDescription: yn[e.tacticsProfile],
		aborted: e.aborted,
		anyPcDownPercent: i,
		anyPcDownCi: o,
		tpkPercent: a,
		tpkCi: s,
		meanFirstDownRound: e.meanFirstDownRound === null ? "n/a" : e.meanFirstDownRound.toFixed(1),
		meanFirstDownCi: c,
		medianFirstDownRound: e.medianFirstDownRound === null ? "n/a" : String(e.medianFirstDownRound),
		meanHealsPerIteration: e.safetyNet.meanHealsPerIteration.toFixed(1),
		meanRecoveryChecksPerIteration: e.safetyNet.meanRecoveryChecksPerIteration.toFixed(1),
		heroPointSurvivalPercent: Math.round(e.safetyNet.heroPointSurvivalRate * 100),
		perPc: e.perPc.map((t) => {
			let r = wn(t.downProbability, e.iterationsCompleted), i = wn(t.deathProbability, e.iterationsCompleted);
			return {
				id: t.id,
				name: t.name,
				downPercent: Math.round(t.downProbability * 100),
				downCi: r ? `${Math.round(r.lower * 100)}%–${Math.round(r.upper * 100)}%` : null,
				deathPercent: Math.round(t.deathProbability * 100),
				deathCi: i ? `${Math.round(i.lower * 100)}%–${Math.round(i.upper * 100)}%` : null,
				meanEndingHp: t.meanEndingHp.toFixed(1),
				topContributingEnemyName: t.topContributingEnemyId ? n.get(t.topContributingEnemyId) ?? t.topContributingEnemyId : "—",
				riskClass: En(t.downProbability),
				riskLabel: Tn(t.downProbability)
			};
		}),
		perEnemy: e.perEnemy.map((e) => ({
			id: e.id,
			name: e.name,
			damageSharePercent: Math.round(e.damageShare * 100),
			topTargetName: e.topTargetId ? t.get(e.topTargetId) ?? e.topTargetId : "—"
		})),
		caveats: e.caveats
	};
}
function wn(e, t) {
	if (t === 0) return null;
	let n = e, r = 1.959963984540054 * Math.sqrt(n * (1 - n) / t);
	return {
		lower: Math.max(0, n - r),
		upper: Math.min(1, n + r)
	};
}
function Tn(e) {
	return e < .05 ? "Low" : e < .15 ? "Guarded" : e < .35 ? "Dangerous" : e < .6 ? "Severe" : "Grim";
}
function En(e) {
	return Tn(e).toLowerCase();
}
//#endregion
//#region src/ui/forecast-panel.ts
var Dn = class e extends Application {
	static instance;
	controls = { ...vn };
	runState = { kind: "idle" };
	currentHandle;
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id: `${t}-forecast`,
			title: `${n} — Encounter Forecast`,
			template: `modules/${t}/templates/forecast-panel.hbs`,
			width: 800,
			height: "auto",
			resizable: !0,
			classes: ["grim-arithmetic-window"]
		});
	}
	static getInstance() {
		return e.instance ||= new e(), e.instance;
	}
	static open() {
		e.getInstance().render(!0);
	}
	async getData() {
		return bn({
			moduleVersion: r,
			enabled: h(),
			controls: this.controls,
			state: this.runState
		});
	}
	activateListeners(e) {
		super.activateListeners(e), e.find("[data-grim-forecast-control]").on("change", (e) => {
			let t = e.currentTarget;
			t.dataset?.grimForecastControl === "tacticsProfile" && (t.value === "random-legal" || t.value === "spread-damage" || t.value === "focus-fire" || t.value === "predator" || t.value === "boss-cinematic") && (this.controls.tacticsProfile = t.value), this.render(!1);
		}), e.find("[data-grim-forecast-run]").on("click", () => {
			this.startRun();
		}), e.find("[data-grim-forecast-cancel]").on("click", () => {
			this.currentHandle?.cancel();
		});
	}
	async close(e) {
		return this.currentHandle?.cancel(), super.close(e);
	}
	startRun() {
		let e = new O(), t;
		try {
			t = nn(e);
		} catch (e) {
			this.runState = {
				kind: "error",
				message: e instanceof Error ? e.message : String(e)
			}, this.render(!1);
			return;
		}
		if (t.pcs.length === 0 || t.enemies.length === 0) {
			this.runState = {
				kind: "error",
				message: "No active combat with both PCs and enemies. Start a combat encounter, then run the forecast."
			}, this.render(!1);
			return;
		}
		let n = {
			iterations: 5e3,
			tacticsProfile: this.controls.tacticsProfile,
			maxRounds: 5
		};
		this.runState = {
			kind: "running",
			completed: 0,
			total: 5e3
		}, this.render(!1);
		let r = $t(t, n, { onProgress: (e, t) => {
			this.runState.kind === "running" && (this.runState = {
				kind: "running",
				completed: e,
				total: t
			}, this.render(!1));
		} });
		this.currentHandle = r, r.promise.then((e) => {
			this.runState = {
				kind: "done",
				result: e
			}, this.currentHandle = void 0, this.render(!1);
		}, (e) => {
			this.runState = {
				kind: "error",
				message: e instanceof Error ? e.message : String(e)
			}, this.currentHandle = void 0, this.render(!1);
		});
	}
};
//#endregion
//#region src/foundry/selection.ts
function On() {
	return kn({
		controlled: canvas.tokens?.controlled,
		targets: game.user?.targets
	});
}
function kn(e) {
	let t = e.controlled ?? [], n = Array.from(e.targets ?? []), r = [], i = t.length === 1 ? t[0] : null, a = n.length === 1 ? n[0] : null;
	return t.length === 0 && r.push("No PC token selected. Select one PC token."), t.length > 1 && r.push("Multiple tokens selected. Select only one PC token."), n.length === 0 && r.push("No target selected. Target one enemy token."), n.length > 1 && r.push("Multiple targets selected. Target only one enemy token."), {
		subjectToken: i,
		enemyToken: a,
		errors: r
	};
}
//#endregion
//#region src/ui/pair-detail-resolver.ts
function An(e, t) {
	let n = [];
	return e || n.push("PC token is no longer on the canvas. The encounter may have changed since the danger board was rendered."), t || n.push("Enemy token is no longer on the canvas. The encounter may have changed since the danger board was rendered."), {
		subjectToken: e,
		enemyToken: t,
		errors: n
	};
}
//#endregion
//#region src/ui/pair-detail-panel.ts
var $ = class e extends Application {
	static instance;
	controls = { ...ln };
	explicitSelection;
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id: `${t}-pair-detail`,
			title: `${n} — Pair Detail`,
			template: `modules/${t}/templates/pair-detail-panel.hbs`,
			width: 500,
			height: "auto",
			resizable: !0,
			classes: ["grim-arithmetic-window"]
		});
	}
	static getInstance() {
		return e.instance ||= new e(), e.instance;
	}
	static openForPair(t, n, r) {
		let i = canvas.tokens?.get(t) ?? null, a = canvas.tokens?.get(n) ?? null, o = e.getInstance();
		o.explicitSelection = An(i, a), r !== void 0 && (o.controls.attackId = r), o.render(!0);
	}
	static openForSelection() {
		let t = e.getInstance();
		t.explicitSelection = void 0, t.render(!0);
	}
	async getData() {
		return un({
			selection: this.explicitSelection ?? On(),
			adapter: new O(),
			controls: this.controls,
			moduleVersion: r
		});
	}
	activateListeners(e) {
		super.activateListeners(e), e.find("[data-grim-control]").on("change", (e) => {
			let t = e.currentTarget, n = In(t);
			n && (this.updateControl(n, t.value), this.render(!1));
		}), e.find("[data-grim-refresh]").on("click", () => {
			this.render(!1);
		});
	}
	updateControl(e, t) {
		e === "strikes" && (this.controls.strikes = jn(Number(t))), e === "mapMode" && (this.controls.mapMode = Mn(t)), e === "shieldBonus" && (this.controls.shieldBonus = Nn(t)), e === "woundedOverride" && (this.controls.woundedOverride = Pn(t)), e === "heroPointMode" && (this.controls.heroPointMode = Fn(t)), e === "attackId" && (this.controls.attackId = t);
	}
};
function jn(e) {
	return e === 1 || e === 2 || e === 3 ? e : 2;
}
function Mn(e) {
	return e === "normal" || e === "agile" || e === "none" ? e : "auto";
}
function Nn(e) {
	return e === "1" ? 1 : e === "2" ? 2 : 0;
}
function Pn(e) {
	return e === "0" || e === "1" || e === "2" || e === "3" ? e : "current";
}
function Fn(e) {
	return e === "available" || e === "unavailable" ? e : "actor";
}
function In(e) {
	let t = e.dataset?.grimControl;
	return t === "strikes" || t === "mapMode" || t === "shieldBonus" || t === "woundedOverride" || t === "heroPointMode" || t === "attackId" ? t : null;
}
//#endregion
//#region src/ui/danger-board-panel.ts
var Ln = "Encounter-wide immediate risk. Click a row to see the detail math, or use the selection-target button to model an arbitrary pair.", Rn = class extends Application {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id: `${t}-danger-board`,
			title: `${n} — Encounter Danger Board`,
			template: `modules/${t}/templates/danger-board-panel.hbs`,
			width: 640,
			height: "auto",
			resizable: !0,
			classes: ["grim-arithmetic-window"]
		});
	}
	async getData() {
		let e = new O();
		return {
			moduleVersion: r,
			message: Ln,
			dangerBoard: it(Ce(Ne(e), {
				adapter: e,
				controls: ln,
				pairLimit: 200
			})),
			forecastEnabled: h()
		};
	}
	activateListeners(e) {
		super.activateListeners(e), e.find("[data-grim-open-detail-pair]").on("click", (e) => {
			let t = e.currentTarget.dataset, n = t?.grimPcId, r = t?.grimEnemyId, i = t?.grimAttackId;
			!n || !r || $.openForPair(n, r, i);
		}), e.find("[data-grim-open-detail-selection]").on("click", () => {
			$.openForSelection();
		}), e.find("[data-grim-open-forecast]").on("click", () => {
			Dn.open();
		}), e.find("[data-grim-refresh]").on("click", () => {
			this.render(!1);
		});
	}
}, zn = `${t}-open-panel`;
function Bn() {
	new Rn().render(!0);
}
function Vn() {
	Hooks.on("getSceneControlButtons", (e) => {
		let t = e.tokens;
		t && (t.tools[zn] = {
			name: zn,
			title: "Grim Arithmetic",
			icon: "fa-solid fa-skull",
			order: Object.keys(t.tools).length,
			button: !0,
			visible: !!game.user?.isGM,
			onChange: Bn
		});
	});
}
//#endregion
//#region src/main.ts
Hooks.once("init", () => {
	console.log(`${n} | Initializing`), m(), Vn(), Hn();
});
function Hn() {
	let e = globalThis.Handlebars;
	e && e.registerHelper("eq", function(e, t) {
		return e === t;
	});
}
Hooks.once("ready", () => {
	if (!game.user?.isGM) return;
	let e = game.modules.get(t);
	e && (e.api = {
		openPanel: () => new Rn().render(!0),
		openPairDetail: (e, t, n) => $.openForPair(e, t, n),
		openPairDetailFromSelection: () => $.openForSelection(),
		openForecast: () => Dn.open(),
		captureTokenDebug: (e = canvas.tokens?.controlled?.[0]) => a(e)
	});
});
//#endregion
