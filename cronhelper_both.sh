#!/bin/bash
adddate() {
	while IFS= read -r line; do
		printf "%s %s\n" "$(date)" "$line"
	done
}

exec "$@" 2>&1 | adddate
