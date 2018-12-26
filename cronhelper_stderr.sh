#!/bin/bash
adddate() {
	while IFS= read -r line; do
		printf "%s %s\n" "$(date)" "$line"
	done
}

exec "$@" 3>&1 1>&2 2>&3 | adddate
