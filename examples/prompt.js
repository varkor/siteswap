/* A simple program that prompts the user for a pattern, validates it as a siteswap, and returns some basic properties of the siteswap if it is valid. */
"use strict";

// Import our dependencies.
const readline = require("readline");
const { Siteswap } = require("../index.js");

// Just some boilerplate for interfacing with the terminal.
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

// Prompt the user for a pattern.
rl.question("Enter a siteswap: ", (pattern) => {
	try {
		// Attempt to create a siteswap from the user-supplied string.
		const siteswap = new Siteswap(pattern);
		if (siteswap.valid) {
			// In this case, the siteswap is valid, and we have access to a range of properties, which we can display to the user.
			console.log(`${siteswap.pattern} is a${siteswap.ground ? " ground" : "n excited"}-state period-${siteswap.period} pattern, juggled with ${siteswap.cardinality} prop${siteswap.cardinality !== 1 ? "s" : ""}.`);
		} else {
			// Here, the siteswap was syntactically correct, but had an issue, either with an invalid number of props or with collisions.
			console.log(`${pattern} is an invalid siteswap!`);
		}
	} catch (error) {
		// Catch any syntax errors and handle them differently to siteswaps that are simply invalid.
		console.log(`"${pattern}" is not a siteswap!`);
	}
	// Clean up after ourselves.
	rl.close();
});