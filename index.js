"use strict";

class SiteswapError extends Error {
	constructor (message) {
		super(message);
		this.name = "SiteswapError";
	}
}

class Siteswap {
	constructor (pattern, { allowTheoreticalPatterns = false, maximumLength = 100 } = {}) {
		// Whitespace is irrelevant in a siteswap, so we remove it to make subsequent parsing simpler.
		pattern = pattern.replace(/\s/g, "");
		// Siteswap notation is case-insensitive, so we make all letters lowercase to be consistent.
		pattern = pattern.toLowerCase();

		// The string that was inputted (save whitespace removal and lowercasing), for user-facing consistency. In most cases, however, the normalised form will be used instead.
		this.pattern = pattern;

		// The empty siteswap, ε, is invalid (as are all period-0 siteswaps).
		if (pattern === "") {
			this.valid = false;
			// The empty siteswap has a special name, which is generally deemed to be more helpful than an empty string.
			this.pattern = "ε";
			this.period = 0;
			return;
		}

		// We first test that the siteswap is syntactically valid (actual validity checking will be performed if it passes the syntax checks).
		const syntax = {};
		// Theoretical siteswaps may contain events of negatives values, negative quantities of events, or negative quantities of actions. In each case, this involves potentially prefixing the value or quantity with a unary minus sign (-).
		syntax.sign = `(-?)`;
		// A value can have any nonnegative integer value (\d), or a letter up to "o" (a-o) (letters from "p" onwards may be used for throw modifiers). Alternatively, for more flexibility, a digital value may be used, surrounded with curly brackets ({ and }).
		syntax.value = `(${syntax.sign}[\\da-o]|\\{${syntax.sign}\\d+\\})`;
		// A quantity represents the repetition of some value (such as an event or action), as a useful syntactic shorthand. Quantities are represented by an exponent (\^) sign followed by a value.
		syntax.quantity = `(\\^${syntax.value})`;
		// A suppression represents the suppression of implicit zero beats after a synchronous group. Suppression is represented by some quantity of exclamation mark (!) signs.
		syntax.suppression = `(!+)`;
		// Crosses are instructions to throw a prop to a different hand, in a synchronous pattern. Crosses are represented by some quantity of exes (x).
		syntax.cross = `(x)`;
		// An event defines the behaviour of a single prop at a single point in time.
		syntax.event = `(${syntax.value}${syntax.cross}*)`;
		syntax.events = `(${syntax.event}${syntax.quantity}?)`;
		// An action defines the behaviour of all props whose state is modified at a single point in time (for example, a multiplex), by a single hand. It takes the form of any positive number of events surrounded in square brackets. Alternatively, an event can be used in place of an action to represent the action containing just that event.
		syntax.action = `(\\[${syntax.events}+\\]|${syntax.event})`;
		syntax.actions = `(${syntax.action}${syntax.quantity}?)`;
		// A tuple defines the behaviour of all actions performed by all hands at a single point in time. It takes the form of a comma-separated list of actions, surrounded in brackets.
		syntax.tuple = `((\\(${syntax.action}(,${syntax.action})*\\))`;
		// A group is a tuple with optional suppression after it. Alternatively, an action can be used in place of a tuple to represent an otherwise-zero-filled group containing a single action, at an incrementing index, with suppression such that the action only takes up a single beat.
		syntax.group = `(${syntax.tuple}${syntax.suppression}?|${syntax.action}))`;
		syntax.groups = `(${syntax.group}${syntax.quantity}?)`;
		// A pattern is any sequence of events, actions or groups.
		syntax.pattern = `(${syntax.groups}+)`;

		// We only go on to more thorough validity checks if the input pattern syntactically matches the format of a siteswap.
		if (new RegExp(`^${syntax.pattern}$`).test(pattern)) {
			// Negative-value events and negative quantities of events and actions are only permitted if `allowTheoreticalPatterns` is enabled.
			if (!allowTheoreticalPatterns && /-/.test(pattern)) {
				throw new SiteswapError(`The pattern "${pattern}" contains negative throws or negative quantities, which are only permitted in theoretical siteswaps.`);
			}

			let period = 0;
			let cardinality = 0;

			// The letter "o" is the maximum alphanumeric value permitted, as explained above.
			const base = "o".charCodeAt(0) - ("a".charCodeAt(0) - 1) + 10;
			// `convertValue` converts a value, either in 0 – 9, a – o notation, or in {n} notation, to the equivalent integer.
			function convertValue (string) {
				if (string[0] === "{") {
					return parseInt(string.slice(1, -1));
				}
				return parseInt(string, base);
			}
			// `convertInteger` converts an integer to the equivalent value, as a string.
			function convertInteger (integer) {
				if (integer >= base) {
					return `{${integer}}`;
				}
				if (integer >= 10) {
					return String.fromCharCode("a".charCodeAt(0) - 10 + integer);
				}
				return `${integer}`;
			}

			// `decomposeChain` takes a string of expressions, each of which is either a single element, or an element with a specified quantity using the power (^) operate, and returns { element, quantity } pairs. This is used to parse events, actions and groups.
			function* decomposeChain (string, expression, subexpression) {
				const chains = string.match(new RegExp(expression, "g"));
				if (chains !== null) {
					for (const chain of chains) {
						let element;
						let quantity;
						if (new RegExp(`${syntax.quantity}$`).test(chain)) {
							element = chain.match(new RegExp(subexpression, "g"))[0];
							quantity = convertValue(chain.match(new RegExp(`${syntax.quantity}$`, "g"))[0].match(new RegExp(syntax.value, "g"))[0]);
						} else {
							// Default element and quantity in the case no quantity is present.
							element = chain;
							quantity = 1;
						}
						yield { element, quantity };
					}
				}
			}

			// `hands` is the number of hands used in the siteswap. Implicit siteswaps with no synchronous throws are validated as one-handed siteswaps.
			let hands = null;
			let hand;

			// `groups` holds the chain pairs of groups, actions and events, which will be used for later analysis.
			let groups = [];
			let implicit = [];
			// `hand` is the index of the hand to be used for the next implicit group action (i.e. action that is not written as part of a set of synchronous throws).
			hand = 0;
			for (const group of decomposeChain(pattern, syntax.groups, syntax.group)) {
				const actions = [];
				const suppression = (group.element.match(new RegExp(`${syntax.suppression}$`, "g")) || []).reduce((suppression, match) => suppression + match.length, 0);
				groups.push({ actions, quantity: group.quantity, suppression });
				for (const action of decomposeChain(group.element, syntax.actions, syntax.action)) {
					const events = [];
					actions.push({ events });
					for (const event of decomposeChain(action.element, syntax.events, syntax.event)) {
						const value = convertValue(event.element.match(new RegExp(`^${syntax.value}`))[0]);
						const offset = (event.element.match(new RegExp(`${syntax.cross}`, "g")) || []).length;
						// Events of the form 0x^n are only permitted if `allowTheoreticalPatterns` is enabled.
						if (!allowTheoreticalPatterns && value === 0 && offset !== 0) {
							throw new SiteswapError(`The pattern "${pattern}" contains crossing 0 throws, which are only permitted in theoretical siteswaps.`);
						}
						events.push({
							value,
							offset,
							quantity: event.quantity
						});
						cardinality += value * event.quantity * group.quantity;
					}
				}
				if (suppression < 0 || suppression >= actions.length) {
					// The suppression of a group must be a nonnegative integer less than the number of actions in that group. This prevents a group taking fewer than one beat, or a greater number of beats than the number of actions.
					throw new SiteswapError(`The pattern "${pattern}" supresses a set of synchronous throws by an invalid quantity.`);
				}
				period += group.quantity * (actions.length - suppression);
				// If the group is represented by a single action, it means it's not surrounded by brackets, and the other actions are implicit (zero); alternatively, implicit actions can be specified explicitly: these are treated identically in order to aid the simplification procedures.
				if (new RegExp(`^${syntax.action}$`).test(group.element)) {
					const index = groups.length - 1;
					implicit.push({ index, group: groups[index], hand });
					++ hand;
				} else {
					if (hands === null) {
						// If `hands` is null, then we should attempt to derive the numbers of hands. In the presence of an explicit group, this is simply the number of actions.
						hands = actions.length;
					} else if (actions.length !== hands) {
						// The number of actions in any explicit group should be consistent.
						throw new SiteswapError(`The pattern "${pattern}" has an inconsistent hand-count.`);
					}
					// Immediately after any set of synchronous throws, the leading hand is reset.
					hand = 0;
				}
			}
			// Implicit group actions at the start of the pattern may have the incorrect hand, because it is dependent on the preceding tuple.
			// If all the throws are implicit, we want to retain our zero-based indexing.
			if (implicit.length < groups.length) {
				implicit.filter((inference, index) => inference.index === index).forEach(inference => {
					// Reset the hand so that it wraps around from the end of the pattern and is thus correct.
					inference.hand = hand;
					++ hand;
				});
			}
			// The number of hands has now been determined. Note that if the number of hands is not explicit, we leave it as null.
			this.hands = hands;
			// If there have been no explicit groups (sets of synchronous throws), we may validate the siteswap as a one-handed siteswap.
			if (hands === null) {
				hands = 1;
			}
			// There should not be more than one less x than the number of hands (wrapping the offset is unnecessary and makes the syntax unnecessarily lax).
			if (groups.some(({actions}) => actions.some(({events}) => events.some(({offset}) => offset >= hands)))) {
				throw new SiteswapError(`The pattern "${pattern}" has a throw with an offset greater than or equal to the hand-count.`);
			}
			// Note that implicit group actions are left as singleton arrays for now. We want to delay processing them until we have more information regarding the minimal period, to decrease the computational complexity.

			// Period-0 siteswaps are invalid.
			if (period === 0) {
				this.valid = false;
				this.period = 0;
				return;
			}

			// An early invalidity check: valid siteswaps must have an integer cardinality.
			if (cardinality % period !== 0) {
				this.valid = false;
				return;
			}

			// We can be sure, at this stage, that the period and cardinality are valid, even if there are collisions in the pattern. However, we choose to return the minimal period of a pattern, after normalising, so we do not wish to set the period quite yet. For example, we want the period of 333 to be 1, rather than 3.
			this.cardinality = cardinality /= period;

			// There are many ways to represent the same siteswap. For example, the multiplexes [34] and [43] are isomorphic (although some distinction might be desirable when the props operated on by the events are not identical), and given any action, X, and quantity Y the chain X^Y can be decomposed into a Y-fold repetition of X (among other decompositions). Although the algorithm below can operate on siteswaps of any form, it is helpful to do some normalisation beforehand to decrease the computational cost of validation. The normal form is simply used for validation. The original pattern is conserved for consistency with the user's expectations.
			// The normal form for a siteswap is defined such that: a) the only time 0 occurs is as a singleton action (i.e. there are no 0s within multiplexes); b) events are ordered from least to greatest within each action; c) any identical adjacent chains of events, actions or groups are combined, and their quantities summed; d) all quantities are non-zero; d) the siteswap has minimal period (for example, 33 is normalised to 3, which is isomorphic).
			// The canonical form for a siteswap has the extra requirement that: e) all quantities are positive. This requires an extra processing step, however, and does not lower the computational cost, so it is not performed for preprocessing.

			// Collapse adjacent chains with equal values and remove chains with quantity 0.
			function reduceSequence(sequence, equal) {
				return sequence.reduce((chains, chain) => {
					// If the current chain is not the same as the previous one, then it forms a new part of the reduced sequence.
					if (chains.length === 0 || !equal(chain, chains[chains.length - 1])) {
						chains.push(chain);
					} else {
						// If the current chain matches the previous one, we can simply add their quantities together.
						chains[chains.length - 1].quantity += chain.quantity;
					}
					return chains;
				}, []).filter((chain) => chain.quantity !== 0); // Empty chains are vacuously useless and can be removed safely.
			}

			// Return an array with the smallest length such that the periodic input sequence can be reduced to it (discarding the number of repetitions).
			function reducePeriod(sequence, equal) {
				// `interval` represents the period of the sequence, named such just to avoid confusion with the period of the siteswap, which is not the same, as interval does not take into account chain quantities.
				let interval = sequence.length;
				// To find the minimal period length, we start with the minimal possible length, and keep checking whether the current slice length is valid. As we're working from smallest to largest, we can return as soon as we find a satisfying slice.
				for (let slice = 1; slice <= sequence.length / 2; ++ slice) {
					// The potential period has to divide the pattern length.
					if (sequence.length % slice !== 0) {
						continue;
					}
					let failure = false;
					// For each pair of subsequences of our slice length, we compare the elements pairwise.
					for (let offset = 0; !failure, offset < sequence.length / slice - 1; ++ offset) {
						for (let index = 0; index < slice; ++ index) {
							// If we find a single mismatch, this slice cannot represent the smallest period.
							if (!equal(sequence[offset * slice + index], sequence[(offset + 1) * slice + index])) {
								failure = true;
								break;
							}
						}
					}
					// If we didn't find a single failure point, then this slice must be a valid representation of the entire pattern.
					if (!failure) {
						interval = slice;
						break;
					}
				}
				period *= interval / sequence.length;
				// If the period of the sequence is one, then we can reduce the quantity of the solve chain of actions too.
				if (interval === 1) {
					// Note that, because normalisation conserves the sign of the quantities of chains (as opposed to canonicalisation), we can't just set the quantity to 1 at this point.
					sequence[0].quantity = Math.sign(sequence[0].quantity);
					// As there are implicit empty beats after groups (of more than one action), we need to make sure we conserve these when reducing the period.
					period = sequence[0].quantity * (sequence[0].actions.length - sequence[0].suppression);
				}
				return sequence.slice(0, interval);
			}

			const equality = {
				events: (a, b) => a.value === b.value && a.offset === b.offset,
				actions: (a, b) => a.events.length === b.events.length && a.events.every((event, index) => equality.events(event, b.events[index]) && event.quantity === b.events[index].quantity),
				groups: (a, b) => a.actions.length === b.actions.length && a.suppression === b.suppression && a.actions.every((action, index) => equality.actions(action, b.actions[index]))
			};
			for (const group of groups) {
				for (const action of group.actions) {
					// First, remove all non-crossing zeroes (as they are entirely superfluous unless as a singleton).
					action.events = action.events.filter(({value, offset}) => value !== 0 || offset !== 0);
					// Second, sort the events within the action by value (least to greatest).
					action.events.sort((a, b) => a.value - b.value);
					// Next, collapse adjacent events whose values are equal, and remove any chains of quantity 0.
					action.events = reduceSequence(action.events, equality.events);
					// If we've managed to get rid of all the events entirely, we do want at least one zero (to make the validation simpler later, and avoid having to special-case for 0).
					if (action.events.length === 0) {
						action.events.push({ value: 0, offset: 0, quantity: 1 });
					}
				}
			}

			// Now, collapse adjacent groups whose actions are the same, and remove any chains of quantity 0.
			groups = reduceSequence(groups, equality.groups);
			// Finally, we want to reduce the siteswap to its period, with no repetitions.
			groups = reducePeriod(groups, equality.groups);
			implicit = implicit.filter(({group}) => groups.includes(group));

			// We now set the period, after we've normalised the siteswap.
			this.period = period;

			// Convert implicit group actions to explicit group actions.
			for (const {index, hand} of implicit) {
				// Note that this step assumes that if all groups actions are implicit, then we're validating for one hand only (otherwise we might need to repeat the implicit throws to make sure that the pattern cycled properly).
				const group = groups[index];
				group.suppression = hands - 1;
				group.actions.unshift(...Array.from(new Array(hand % hands), () => ({ events: [{ value: 0, offset: 0, quantity: 1 }] })));
				group.actions.push(...Array.from(new Array(hands - (hand % hands + 1)), () => ({ events: [{ value: 0, offset: 0, quantity: 1 }] })));
			}

			let position;

			function mod (x, n) {
				// A correct definition of the modulo operator for negative numbers.
				return ((x % n) + n) % n;
			}

			// Validating the siteswap involves solving a system of linear equations. As a siteswap operates over a hypothetically-infinite set of states, we need to find the range of states (for each hand) over which it actually operates in order to make the problem tractable.
			const ranges = Array.from(new Array(hands), () => [Infinity, -Infinity]);

			function extendRange (index, value) {
				// Extends a [min, max] range to include the given value.
				const [min, max] = ranges[mod(index, hands)];
				ranges[mod(index, hands)] = [Math.min(min, value), Math.max(max, value)];
			}

			position = 0;
			for (const group of groups) {
				// If there are a positive quantity of groups in this chain, the events operate on beats to the right of the position. Otherwise, they operate on beats to the left of the position. `offset` is just a shorthand to reference this difference in behaviour.
				const offset = group.quantity > 0 ? 1 : 0;
				for (let index = 0; index < Math.abs(group.quantity); ++ index) {
					let hand = 0;
					for (const action of group.actions) {
						// For each action, we need to determine whether it extends the range of states that are operated upon. This can be a little subtle, as the affected states depend both on the quantity of actions in the chain, as well as the sign of the events forming the action.
						for (const event of action.events) {
							// Extend the range corresponding to the hand making the current throw.
							extendRange(hand, position + offset);
							// Extend the range corresponding to the landing site of the current throw.
							extendRange(hand + event.value + event.offset, position + offset + event.value);
						}
						++ hand;
					}
					position += group.actions.length - group.suppression;
				}
			}
			
			// In order to validate the siteswap, we build an array the size of the range of states operated upon. For pathological inputs, this could cause issues in terms of memory usage and performance, so we bail out if the size of the state range is too long.
			if (ranges.some(([min, max]) => max - min > maximumLength)) {
				throw new SiteswapError(`The pattern "${pattern}" has a state range greater than limit of ${maximumLength}.`);
			}

			// We now build the system of equations. This involves calculating the difference, or delta, in each beat after a single operation of the sequence.
			const deltas = ranges.map(([min, max]) => new Array(max - min + 1).fill(0));
			position = 0;
			for (const group of groups) {
				const increment = Math.sign(group.quantity);
				const offset = group.quantity > 0 ? 1 : 0;
				let hand = 0;
				for (const action of group.actions) {
					const [min, max] = ranges[hand];
					// The direction we're going to take through the chain of actions depends on the sign of the quantity.
					for (let index = 0; Math.abs(index) < Math.abs(group.quantity); index += increment) {
						// First, for each event in the action, we're going to decrease the delta at the position of the action by one (or increase it if the quantity is negative, as a negative quantity performs the inverse operation).
						deltas[hand][position - min + index + offset] -= action.events.reduce((sum, {quantity}) => sum + quantity, 0) * increment;
						// Next, we're going to increase the delta at the destination position of the event by one (or decrease it if the quantity is negative).
						for (const event of action.events) {
							const target = mod(hand + event.value + event.offset, hands);
							const [min, max] = ranges[target];
							deltas[target][position - min + index + offset + event.value] += event.quantity * increment;
						};
					}
					++ hand;
				}
				position += group.quantity * (group.actions.length - group.suppression);
			}

			// We can now solve the system of equations by equating the original state with the state produced after the operation of the sequence (represented by the deltas).
			const states = deltas.map((delta) => new Array(delta.length).fill(0));
			hand = 0;
			for (const state of states) {
				const [min, max] = ranges[hand];
				for (let index = min; index <= max; ++ index) {
					// We're solving the equations by implicitly assuming there is an infinite sequence of 0-beats before the initial state. "Before", in this case, depends on the sign of the period, so we flip the index if the period is negative.
					// `before` represents the position of the beat in the initial state.
					const before = period < 0 ? max + min - index : index;
					// `after` represents the position of the beat after a single operation of the sequence.
					const after = before - period;
					// Solve the linear equation.
					state[before - min] = (after < min || after > max ? 0 : state[after - min]) - deltas[hand][before - min];
				}
				++ hand;
			}

			// The state before the operation must be the same as the state after the operation. This statement holds if and only if the system of equations is consistent. We've just calculated what the beats in the overlapping range (between the intial state and the state after the operation) must equal in order for the equations to hold. We now just need to check that our assumption, that every beat outside this range is unchanged. If it is not, then for each operation of the sequence, the state is changed, and so the pattern cannot be periodic, which is necessary for the pattern to be valid.
			this.valid = states.every((state) => (period > 0 ? state.slice(-period) : state.slice(0, -period)).every((beat) => beat === 0));
			if (!this.valid) {
				return;
			}

			// We can also check whether the pattern starts off in a ground or excited state. A ground state is one in which it is valid to perform only actions containing events with a value equal to the cardinality of the pattern from this point forth, instead of performing the sequence. For example, the ground state for a cardinality-3 pattern is |1 1 1, whereas the ground state for a pattern with a cardinality of -3 is -1 -1 -1|, where the beat to the right of the bar (|) is the first beat.
			// Check whether each state beat in the range adjacent to the beginning, has the same sign as the cardinality of the siteswap, and is a unit.
			let ground = true;
			hand = 0;
			outer: for (const state of states) {
				const [min, max] = ranges[hand];
				const offset = cardinality > 0 ? 1 : 0;
				for (let beat = hand * Math.sign(cardinality) + offset; Math.abs(beat) < Math.abs(cardinality) + offset; beat += hands * Math.sign(cardinality)) {
					if (beat < min || max < beat || state[beat - min] !== Math.sign(cardinality)) {
						ground = false;
						break outer;
					}
				}
				// Check that all other states are unoccupied (zero).
				if (state.reduce((sum, value) => sum + Math.abs(value), 0) !== Math.floor(Math.abs(cardinality) / hands) + (hand < Math.abs(cardinality) % hands ? 1 : 0)) {
					ground = false;
					break;
				}
				++ hand;
			}
			this.ground = ground;
			// A state is excited if it is not a ground state.
			this.excited = !this.ground;

			// Convert the normalised sequence of actions to a string for displaying back to the user.
			function sequenceToString(sequence, elementToString, cutoff = 2) {
				let string = "";
				for (const chain of sequence) {
					string += elementToString(chain);
					if (chain.quantity !== 1) {
						if (chain.quantity < 0 || chain.quantity >= cutoff) {
							string += `^${convertInteger(chain.quantity)}`;
						} else {
							string += elementToString(chain).repeat(chain.quantity - 1);
						}
					}
				}
				return string;
			}

			// `cutoff` determines how many identical consecutive elements are required before being presented with the exponent (^) notation.
			const cutoff = 2;
			// The normalised form for the siteswap, as described above.
			this.normalised = sequenceToString(groups, ({actions, suppression}) => {
				const substrings = [];
				for (const {events} of actions) {
					const substring = sequenceToString(events, ({value, offset}) =>  convertInteger(value) + (offset < 0 || offset >= cutoff ? `x^${convertInteger(offset)}` : `x`.repeat(offset)), cutoff);
					if (events.length === 0) {
						// 0 is a placeholder symbol for when there are no events.
						substrings.push("0");
					} else if (events.length !== 1 || events[0].quantity !== 1) {
						// If there is only one event in the action, we can use the shorthand notation, without the multiplex brackets.
						substrings.push(`[${substring}]`);
					} else {
						substrings.push(substring);
					}
				}
				return actions.length > 1 || this.hands === 1 ? `(${substrings.join(",")})${"!".repeat(suppression)}` : substrings.join();
			}, cutoff);
		} else {
			throw new SiteswapError(`The string "${pattern}" is syntactically invalid.`);
		}
	}

	static empty (siteswap = new Siteswap()) {
		// The following are a list of properties pertaining to each siteswap (though some may be undefined for certain classes of siteswaps, such as invalid siteswaps).
		siteswap.valid = void 0;
		siteswap.normalised = void 0;
		siteswap.pattern = void 0;
		siteswap.period = void 0;
		siteswap.cardinality = void 0;
		siteswap.hands = void 0;
		siteswap.ground = void 0;
		siteswap.excited = void 0;
		return siteswap;
	}
}

module.exports = {
	Siteswap,
	SiteswapError
};