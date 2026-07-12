window.P42_CONFIG = {
  defaultMode: "auto",
  defaultRelayUrl: /\.vercel\.app$/i.test(window.location.hostname)
    ? window.location.origin
    : "https://parallax42-agent-v2.vercel.app",
  defaultBackendUrl: "https://api.parallax42.bhavukarora.com",
  defaultGatewayHealthUrl: "https://parallax42-compass-gateway.vercel.app/api/health"
};
