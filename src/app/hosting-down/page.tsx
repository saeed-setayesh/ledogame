/**
 * Generic hosting suspension page — intentionally not Ludino-branded.
 * Shown when SERVER_DOWN=true in environment.
 */
export default function HostingDownPage() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        background: "#ffffff",
        color: "#222222",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        fontSize: "14px",
        lineHeight: 1.5,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <div
        style={{
          maxWidth: "640px",
          margin: "0 auto",
          padding: "48px 24px 32px",
        }}
      >
        <div
          style={{
            border: "1px solid #d8d8d8",
            background: "#fafafa",
            padding: "12px 16px",
            marginBottom: "24px",
            fontSize: "13px",
            color: "#555",
          }}
        >
          HTTP/1.1 503 Service Unavailable
        </div>

        <h1
          style={{
            fontSize: "22px",
            fontWeight: 600,
            color: "#1a1a1a",
            margin: "0 0 16px",
            letterSpacing: "-0.02em",
          }}
        >
          Account suspended — payment required
        </h1>

        <p style={{ margin: "0 0 14px", color: "#444" }}>
          This website is currently unavailable because the hosting account
          associated with this domain has been <strong>suspended</strong> due to
          non-payment of hosting services.
        </p>

        <p style={{ margin: "0 0 14px", color: "#444" }}>
          All web, application, and database services for this account have been
          stopped. Visitors cannot access this site until the account holder
          settles the outstanding balance with the hosting provider.
        </p>

        <div
          style={{
            border: "1px solid #e8c4c4",
            background: "#fff8f8",
            padding: "14px 16px",
            margin: "20px 0",
            color: "#5c3d3d",
          }}
        >
          <strong style={{ display: "block", marginBottom: "6px" }}>
            Data retention notice
          </strong>
          Your stored data (files, databases, and backups on this server) will
          remain for <strong>7 days</strong> from the suspension date. If payment
          is not received within this period, all data may be{" "}
          <strong>permanently deleted</strong> and cannot be restored.
        </div>

        <p style={{ margin: "0 0 14px", color: "#444" }}>
          If you are the account owner, sign in to your hosting control panel and
          complete payment to restore service. If you believe this is an error,
          contact your hosting provider billing department.
        </p>

        <p
          style={{
            margin: "28px 0 0",
            fontSize: "12px",
            color: "#888",
            borderTop: "1px solid #e5e5e5",
            paddingTop: "16px",
          }}
        >
          Reference: SUSP-UNPAID · Status: Suspended · Error 503
        </p>
      </div>
    </div>
  );
}
