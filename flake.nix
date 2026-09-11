{
  description = "yarr — self-hostable RSS/Atom feed reader (sroberts fork)";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      # yarr builds for these natively; cross-compiles (zig) are out of scope here.
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
      pkgsFor = system: import nixpkgs { inherit system; };

      # Keep in sync with VERSION in the makefile.
      version = "2.12";
    in
    {
      # `nix develop` — local dev shell with the exact toolchain `make` needs:
      # Go 1.23 plus a C compiler for cgo (mattn/go-sqlite3).
      devShells = forAllSystems (system:
        let pkgs = pkgsFor system; in {
          default = pkgs.mkShell {
            packages = with pkgs; [
              go_1_23      # CLAUDE.md pins Go 1.23
              gnumake      # make serve / test / host
              gopls
              delve
              git
              sqlite       # `sqlite3` CLI to poke at local.db
            ]
            # On Linux add gcc for cgo; on Darwin the stdenv clang is used
            # automatically (adding gcc there can break cgo framework linking).
            ++ pkgs.lib.optionals pkgs.stdenv.isLinux [ pkgs.gcc ];

            shellHook = ''
              export CGO_ENABLED=1
              echo "yarr dev shell · $(go version | cut -d' ' -f3-4)"
              echo "  make serve   # dev server (debug tag) against local.db"
              echo "  make test    # full suite, race-checked build tags"
              echo "  make host    # build out/yarr"
            '';
          };
        });

      # `nix build` — the server binary (CGO + SQLite tags, version baked in).
      packages = forAllSystems (system:
        let pkgs = pkgsFor system; in {
          default = pkgs.buildGoModule {
            pname = "yarr";
            inherit version;
            src = self;

            # Use the checked-in vendor/ tree rather than refetching modules.
            vendorHash = null;

            subPackages = [ "cmd/yarr" ];
            tags = [ "sqlite_foreign_keys" "sqlite_json" ];

            # mattn/go-sqlite3 is cgo; buildGoModule enables CGO by default for
            # native builds, but be explicit so it's obvious why gcc/clang is needed.
            env.CGO_ENABLED = "1";

            ldflags = [
              "-s" "-w"
              "-X main.Version=${version}"
              "-X main.GitHash=${self.shortRev or self.dirtyShortRev or "dev"}"
            ];

            meta = {
              description = "Self-hostable RSS/Atom feed reader (sroberts fork)";
              homepage = "https://github.com/sroberts/yarr";
              mainProgram = "yarr";
            };
          };
        });
    };
}
