export const metadata = {
  title: "503 Service Unavailable",
  description: "Service suspended",
  robots: "noindex, nofollow",
};

export default function HostingDownLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{`
        html,
        body {
          background: #f4f4f4 !important;
          color: #222 !important;
          margin: 0;
          min-height: 100%;
        }
      `}</style>
      {children}
    </>
  );
}
