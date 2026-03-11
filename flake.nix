{
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forEachSystem = f: nixpkgs.lib.genAttrs systems (system: f {
        pkgs = nixpkgs.legacyPackages.${system};
        inherit system;
      });
    in {
      devShells = forEachSystem ({ pkgs, system }: {
        default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # Frontend — Vite + React (npm / Node)
            nodejs_20

            # Backend — Hono server (Bun runtime)
            bun
          ];

          shellHook = ''
            echo ""
            echo "  🗒  Lectio dev environment"
            echo "  node  $(node --version)"
            echo "  bun   $(bun --version)"
            echo ""
            echo "  Frontend:  cd frontend && npm install && npm run dev"
            echo "  Backend:   cd backend  && bun install  && bun run dev"
            echo "  Both:      npm run dev:all  (from repo root)"
            echo ""
          '';
        };
      });
    };
}
