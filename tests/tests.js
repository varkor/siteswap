"use strict";
const { Siteswap, SiteswapError } = require("../index.js");

// A collection of terminal commands for prettier printing.
const colours = {
	// Commands.
	blink: "\x1b[5m",
	bright: "\x1b[1m",
	dim: "\x1b[2m",
	hidden: "\x1b[8m",
	reset: "\x1b[0m",
	reverse: "\x1b[7m",
	underscore: "\x1b[4m",
	// Text colours.
	foreground: {
		black: "\x1b[30m",
		blue: "\x1b[34m",
		cyan: "\x1b[36m",
		green: "\x1b[32m",
		magenta: "\x1b[35m",
		red: "\x1b[31m",
		white: "\x1b[37m",
		yellow: "\x1b[33m"
	},
	// Background colours.
	background: {
		black: "\x1b[40m",
		blue: "\x1b[44m",
		cyan: "\x1b[46m",
		green: "\x1b[42m",
		magenta: "\x1b[45m",
		red: "\x1b[41m",
		white: "\x1b[47m",
		yellow: "\x1b[43m"
	}
};

// Test the given pattern to ensure it either validates or invalidates.
function verifySiteswap (pattern, validate = true, settings = void 0, properties = {}) {
	let success;
	// Siteswaps are disallowed if they cause the validator to throw some sort of error. This means the string that was entered was not in a valid format for a siteswap.
	let disallowed = true;
	let siteswap = null;
	try {
		siteswap = new Siteswap(pattern, settings);
		disallowed = false;
		// Optionally check that it contains all the specified properties and associated values, for stronger proof of correctness.
		for (const [property, value] of Object.entries(Object.assign({ valid: true }, properties))) {
			if (siteswap[property] !== value) {
				throw new SiteswapError(`The siteswap ${siteswap.pattern} was expected to have ${property} ${value}, but instead had ${property} ${siteswap[property]}.`);
			}
		}
		success = validate;
	} catch (error) {
		success = !validate;
		if (!(error instanceof SiteswapError)) {
			throw error;
		}
	}
	// Print a message confirming or refuting the success of the test.
	const colour = success ? colours.foreground.green : colours.foreground.red;
	console.log(`${colour}${success ? "✓" : "✗"}\t${colours.dim}[${disallowed ? "Forbidden" : success === validate ? "  Valid  " : " Invalid "}] ${colours.reset + colour + colours.bright}${pattern}${siteswap !== null ? ` ${colours.reset + colour + colours.dim}(${JSON.stringify(siteswap, null, 1).replace(/\n/g, "")})` : ""}${colours.reset}`);
	return success;
}

// Check to make sure the pattern is a valid siteswap.
function validateSiteswap (pattern, settings = void 0, properties = {}) {
	return verifySiteswap(pattern, true, settings, properties);
}

// Check to make sure the pattern is invalidated, either because there's a syntax error, or because the siteswap is invalid.
function invalidateSiteswap (pattern, settings = void 0, properties = {}) {
	return verifySiteswap(pattern, false, settings, properties);
}

// An syntactically invalid pattern.
invalidateSiteswap("-");
// The empty siteswap.
invalidateSiteswap("");
// A vanilla siteswap.
validateSiteswap("744", void 0, { period: 3, cardinality: 5 });
// A vanilla siteswap with a length longer than its actual period.
validateSiteswap("333");
// A multiplex siteswap.
validateSiteswap("[43]23");
// A negative siteswap (without enabling theoretical siteswaps).
invalidateSiteswap("-5");
// A negative siteswap (enabling theoretical siteswaps).
validateSiteswap("-5", { allowTheoreticalPatterns: true });
// A siteswap with an exponentiation.
validateSiteswap("b4^6");
// A siteswap with a negative cardinality.
validateSiteswap("5^-1", { allowTheoreticalPatterns: true });
// An invalid period-0 siteswap.
invalidateSiteswap("11^-1", { allowTheoreticalPatterns: true });
// A siteswap with an absurd length.
invalidateSiteswap("1^{99}20");
// A simple invalid siteswap.
invalidateSiteswap("321");