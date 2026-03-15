{
  inputs = {
    nixpkgs.url     = "github:NixOS/nixpkgs/nixos-unstable";
    rust-overlay.url = "github:oxalica/rust-overlay";
    rust-overlay.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = { self, nixpkgs, rust-overlay }:
    let
      system = "x86_64-linux";
      pkgs   = import nixpkgs {
        inherit system;
        overlays = [ rust-overlay.overlays.default ];
      };

      rust = pkgs.rust-bin.stable.latest.default.override {
        extensions = [ "rust-src" "rust-analyzer" "clippy" ];
        targets    = [ "x86_64-unknown-linux-gnu" ];
      };

      # Tauri runtime deps (WebKitGTK + friends)
      tauriDeps = with pkgs; [
        webkitgtk_4_1
        gtk3
        glib
        dbus
        openssl
        librsvg
        libsoup_3
        pango
        cairo
        gdk-pixbuf
        atk
        harfbuzz
        freetype
        fontconfig
        xorg.libX11
        xorg.libxcb
        xorg.libXext
        xorg.libXrandr
        xorg.libXi
        xorg.libXfixes
        xorg.libXcomposite
        xorg.libXdamage
      ];
    in {
      devShells.${system}.default = pkgs.mkShell {
        buildInputs = [
          rust
          pkgs.nodejs_20
          pkgs.nodePackages.npm
          pkgs.pkg-config
          pkgs.curl
          pkgs.wget
          pkgs.file
          pkgs.gnumake
        ] ++ tauriDeps;

        shellHook = ''
          export PKG_CONFIG_PATH="${pkgs.openssl.dev}/lib/pkgconfig:${pkgs.webkitgtk_4_1.dev}/lib/pkgconfig:$PKG_CONFIG_PATH"
          export LD_LIBRARY_PATH="${pkgs.lib.makeLibraryPath tauriDeps}:$LD_LIBRARY_PATH"
          export WEBKIT_DISABLE_COMPOSITING_MODE=1
          export XDG_DATA_DIRS="${pkgs.gsettings-desktop-schemas}/share/gsettings-schemas/${pkgs.gsettings-desktop-schemas.name}:${pkgs.gtk3}/share/gsettings-schemas/${pkgs.gtk3.name}:$XDG_DATA_DIRS"
          echo "Lectio dev shell — Rust $(rustc --version), Node $(node --version)"
        '';
      };
    };
}
