.PHONY: build install build-install uninstall

PACKAGE_DIR := packages/opencode
INSTALL_BIN ?= $(HOME)/.local/bin
BUILD_FLAGS ?= --single --skip-embed-web-ui

UNAME_S := $(shell uname -s)
UNAME_M := $(shell uname -m)

OPENCODE_OS := $(shell if [ "$(UNAME_S)" = "Darwin" ]; then printf darwin; elif [ "$(UNAME_S)" = "Linux" ]; then printf linux; else printf "$(UNAME_S)" | tr '[:upper:]' '[:lower:]'; fi)
OPENCODE_ARCH := $(shell if [ "$(UNAME_M)" = "arm64" ] || [ "$(UNAME_M)" = "aarch64" ]; then printf arm64; elif [ "$(UNAME_M)" = "x86_64" ] || [ "$(UNAME_M)" = "amd64" ]; then printf x64; else printf "$(UNAME_M)"; fi)
OPENCODE_DIST := $(PACKAGE_DIR)/dist/opencode-$(OPENCODE_OS)-$(OPENCODE_ARCH)

build:
	cd $(PACKAGE_DIR) && bun run build $(BUILD_FLAGS)

install: build
	mkdir -p "$(INSTALL_BIN)"
	cp "$(OPENCODE_DIST)/bin/opencode" "$(INSTALL_BIN)/opencode"
	chmod +x "$(INSTALL_BIN)/opencode"
	"$(INSTALL_BIN)/opencode" --version
	@case ":$$PATH:" in *:"$(INSTALL_BIN)":*) ;; *) printf '\n%s\n' 'Note: $(INSTALL_BIN) is not on PATH. Add it to use opencode from anywhere.' ;; esac

build-install: install

uninstall:
	rm -f "$(INSTALL_BIN)/opencode"
