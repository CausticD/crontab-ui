#!/bin/bash
adddate() {
	while IFS= read -r line; do
		printf "%s %s\n" "$(date)" "$line"
	done
}

exec "$@" | adddate
