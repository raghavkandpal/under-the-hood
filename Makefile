TEST ?=

.PHONY: context test check

# Session start: fetch so ahead/behind is current, then show the planned batch.
context:
	@git fetch -q origin
	@git status --short --branch
	@sed -n '/^## Next batch/,/^## /{/^## How/d;/^$$/d;p;}' ROADMAP.md

test:
	$(if $(TEST),node --test $(TEST),npm test)

check: test
	git diff --check
