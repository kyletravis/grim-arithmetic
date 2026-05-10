//#region src/constants.ts
var e = "grim-arithmetic", t = "Grim Arithmetic";
//#endregion
//#region src/settings.ts
function n() {
	game.settings.register(e, "defaultStrikes", {
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
	}), game.settings.register(e, "debugLogging", {
		name: "Debug logging",
		hint: "Log Grim Arithmetic debug information to the browser console.",
		scope: "client",
		config: !0,
		type: Boolean,
		default: !1
	});
}
//#endregion
//#region src/engine/degree-of-success.ts
var r = [
	"criticalFailure",
	"failure",
	"success",
	"criticalSuccess"
];
function i(e) {
	let { die: t, total: n, dc: r } = e, i;
	return i = n >= r + 10 ? "criticalSuccess" : n >= r ? "success" : n <= r - 10 ? "criticalFailure" : "failure", t === 20 ? a(i, 1) : t === 1 ? a(i, -1) : i;
}
function a(e, t) {
	let n = r.indexOf(e);
	return r[Math.max(0, Math.min(r.length - 1, n + t))];
}
//#endregion
//#region src/engine/attack-probability.ts
function o(e) {
	let t = {
		criticalSuccess: 0,
		success: 0,
		failure: 0,
		criticalFailure: 0
	};
	for (let n = 1; n <= 20; n += 1) {
		let r = i({
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
function s(e) {
	let t = e.replace(/\s+/g, "");
	if (!/^[+-]?(\d+d\d+|\d+)([+-](\d+d\d+|\d+))*$/.test(t)) throw Error(`Unsupported damage formula: ${e}`);
	return (t.match(/[+-]?[^+-]+/g) ?? []).reduce((e, t) => e + c(t), 0);
}
function c(e) {
	let t = e.startsWith("-") ? -1 : 1, n = e.replace(/^[+-]/, ""), r = n.match(/^(\d+)d(\d+)$/);
	if (r) {
		let e = Number(r[1]), n = Number(r[2]);
		return t * e * ((n + 1) / 2);
	}
	return t * Number(n);
}
//#endregion
//#region src/engine/mortality.ts
function l(e) {
	let t = s(e.damageFormula), n = u(e.mapType).slice(0, e.strikes), r = [], i = [], a = 0, c = new Map([[0, 1]]);
	for (let s of n) {
		let n = o({
			attackBonus: e.attackBonus + s,
			ac: e.ac
		});
		r.push(n.success), i.push(n.criticalSuccess);
		let l = t, u = t * 2, f = n.failure + n.criticalFailure;
		a += n.success * l + n.criticalSuccess * u, c = d(c, [
			{
				damage: 0,
				probability: f
			},
			{
				damage: l,
				probability: n.success
			},
			{
				damage: u,
				probability: n.criticalSuccess
			}
		]);
	}
	let l = p(f(c, e.hp));
	return {
		downProbability: l,
		expectedHpAfterTurn: Math.max(0, e.hp - a),
		hitChanceByStrike: r,
		critChanceByStrike: i,
		riskLabel: m(l),
		topRiskDrivers: h(l, i),
		assumptions: [
			"Uses average damage, not full dice distribution.",
			"Critical damage is modeled as simple double damage.",
			`Enemy turn model: ${e.strikes} Strike${e.strikes === 1 ? "" : "s"}.`,
			`MAP model: ${e.mapType}.`
		],
		notModeled: [
			"Resistance, weakness, and immunity.",
			"Deadly, fatal, precision, splash, and persistent damage.",
			"Reactions such as Shield Block or Champion reactions.",
			"Healing before or during the enemy turn.",
			"Permanent death probability."
		]
	};
}
function u(e) {
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
function d(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let [r, i] of e) for (let e of t) {
		if (e.probability === 0) continue;
		let t = r + e.damage, a = i * e.probability;
		n.set(t, (n.get(t) ?? 0) + a);
	}
	return n;
}
function f(e, t) {
	let n = 0;
	for (let [r, i] of e) r >= t && (n += i);
	return n;
}
function p(e) {
	return Math.max(0, Math.min(1, e));
}
function m(e) {
	return e < .05 ? "Low" : e < .15 ? "Guarded" : e < .35 ? "Dangerous" : e < .6 ? "Severe" : "Grim";
}
function h(e, t) {
	if (e === 0) return ["No average hit or crit in the selected sequence downs the PC."];
	let n = Math.max(...t);
	return [`Down risk is primarily crit-driven; highest strike crit chance is ${Math.round(n * 100)}%.`];
}
//#endregion
//#region src/foundry/selection.ts
function g() {
	return _({
		controlled: canvas.tokens?.controlled,
		targets: game.user?.targets
	});
}
function _(e) {
	let t = e.controlled ?? [], n = Array.from(e.targets ?? []), r = [], i = t.length === 1 ? t[0] : null, a = n.length === 1 ? n[0] : null;
	return i || r.push("Select exactly one PC token."), a || r.push("Target exactly one enemy token."), {
		subjectToken: i,
		enemyToken: a,
		errors: r
	};
}
//#endregion
//#region src/systems/pf2e-adapter.ts
var v = -1, y = class {
	id = "pf2e";
	label = "Pathfinder Second Edition";
	getCombatantFromToken(e) {
		let t = e.actor;
		if (!t) return null;
		let n = E(t.system), r = E(n.attributes), i = E(r.hp), a = E(r.ac), o = i.value, s = i.max, c = a.value;
		if (!O(o) || !O(s) || !O(c)) return null;
		let l = E(n.saves), u = E(E(n.resources).heroPoints), d = E(n.traits);
		return {
			id: e.id ?? t.id ?? "",
			name: e.name ?? t.name ?? "Unknown Combatant",
			disposition: b(e, t),
			hp: {
				current: o,
				max: s,
				temp: k(i.temp)
			},
			defenses: {
				ac: c,
				fort: k(E(l.fortitude).value),
				reflex: k(E(l.reflex).value),
				will: k(E(l.will).value)
			},
			deathState: {
				dying: x(t, "dying"),
				wounded: x(t, "wounded"),
				doomed: x(t, "doomed"),
				heroPoints: k(u.value)
			},
			traits: A(d.value),
			assumptions: []
		};
	}
	getAttacksFromToken(e) {
		let t = e.actor;
		return S(t).filter((e) => e.type === "melee").map((e) => {
			let t = E(e.system), n = w(t), r = T(t);
			if (!O(n) || typeof r != "string") return null;
			let i = A(E(t.traits).value);
			return {
				id: e.id ?? "",
				name: e.name ?? "Unknown Strike",
				attackBonus: n,
				damageFormula: r,
				traits: i,
				mapType: i.includes("agile") ? "agile" : "normal",
				assumptions: ["PF2e Strike extraction is first-pass and may miss conditional modifiers."]
			};
		}).filter((e) => e !== null);
	}
};
function b(e, t) {
	return t.type === "character" ? "pc" : e.document?.disposition === v ? "enemy" : "neutral";
}
function x(e, t) {
	return e.itemTypes?.condition?.find((e) => e.slug === t)?.value ?? 0;
}
function S(e) {
	let t = e?.items;
	if (Array.isArray(t)) return t.filter(C);
	if (D(t) && typeof t.filter == "function") {
		let e = t.filter(C);
		return Array.isArray(e) ? e : [];
	}
	return [];
}
function C(e) {
	return D(e);
}
function w(e) {
	return k(E(e.bonus).value) ?? k(E(e.attack).value);
}
function T(e) {
	let t = E(e.damageRolls), n = Object.values(t).find(D);
	if (!n) return;
	let r = n.damage, i = n.formula;
	if (typeof r == "string") return r;
	if (typeof i == "string") return i;
}
function E(e) {
	return D(e) ? e : {};
}
function D(e) {
	return typeof e == "object" && !!e;
}
function O(e) {
	return typeof e == "number" && Number.isFinite(e);
}
function k(e) {
	return O(e) ? e : void 0;
}
function A(e) {
	return Array.isArray(e) ? e.filter((e) => typeof e == "string") : [];
}
//#endregion
//#region src/ui/mortality-panel.ts
var j = class extends Application {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id: `${e}-panel`,
			title: t,
			template: `modules/${e}/templates/mortality-panel.hbs`,
			width: 460,
			height: "auto",
			resizable: !0,
			classes: ["grim-arithmetic-window"]
		});
	}
	async getData() {
		let e = "Permanent death probability is planned for a future milestone and is not modeled in MVP.", t = g();
		if (t.errors.length > 0) return {
			message: "Select a PC token and target one enemy token to estimate immediate down risk.",
			permanentDeath: e,
			errors: t.errors
		};
		let n = new y(), r = n.getCombatantFromToken(t.subjectToken), i = n.getCombatantFromToken(t.enemyToken), a = n.getAttacksFromToken(t.enemyToken)[0], o = M(r, i, a);
		if (o.length > 0 || !r || !i || !a) return {
			message: "Grim Arithmetic could not extract enough PF2e data for this token pair yet.",
			permanentDeath: e,
			errors: o
		};
		let s = N("defaultStrikes", 2), c = a.mapType === "unknown" ? "normal" : a.mapType, u = l({
			hp: r.hp.current + (r.hp.temp ?? 0),
			ac: r.defenses.ac,
			attackBonus: a.attackBonus,
			damageFormula: a.damageFormula,
			strikes: s,
			mapType: c
		});
		return {
			message: "Immediate down-risk estimate based on the selected PC and targeted enemy.",
			permanentDeath: e,
			errors: [],
			subject: r,
			enemy: i,
			attack: a,
			risk: {
				downPercent: P(u.downProbability),
				expectedHpAfterTurn: u.expectedHpAfterTurn.toFixed(1),
				riskLabel: u.riskLabel,
				strikeChances: u.hitChanceByStrike.map((e, t) => ({
					index: t + 1,
					hitPercent: P(e),
					critPercent: P(u.critChanceByStrike[t] ?? 0)
				})),
				assumptions: [...a.assumptions, ...u.assumptions],
				notModeled: u.notModeled
			}
		};
	}
};
function M(e, t, n) {
	let r = [];
	return e || r.push("Could not read selected PC HP/AC from PF2e actor data."), t || r.push("Could not read targeted enemy HP/AC from PF2e actor data."), n || r.push("Could not find a supported melee Strike on the targeted enemy."), r;
}
function N(t, n) {
	let r = game.settings.get(e, t);
	return typeof r == "number" ? r : n;
}
function P(e) {
	return Math.round(e * 100);
}
//#endregion
//#region src/ui/token-controls.ts
function F() {
	Hooks.on("getSceneControlButtons", (t) => {
		if (!game.user?.isGM) return;
		let n = t.find((e) => e.name === "token");
		n && n.tools.push({
			name: `${e}-open-panel`,
			title: "Grim Arithmetic",
			icon: "fas fa-skull",
			button: !0,
			onClick: () => new j().render(!0)
		});
	});
}
Hooks.once("init", () => {
	console.log(`${t} | Initializing`), n(), F();
}), Hooks.once("ready", () => {
	if (!game.user?.isGM) return;
	let t = game.modules.get(e);
	t && (t.api = { openPanel: () => new j().render(!0) });
});
//#endregion

//# sourceMappingURL=grim-arithmetic.js.map