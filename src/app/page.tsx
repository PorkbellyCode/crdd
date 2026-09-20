import Link from "next/link";
import AnalyzeForm from "@/components/AnalyzeForm";

const STEPS = [
  {
    n: "01",
    title: "레포 연결",
    body: "public 레포의 구조와 의존성을 읽어 Knowledge Graph를 만듭니다.",
  },
  {
    n: "02",
    title: "프로젝트 퀴즈",
    body: "그래프·코드·커밋 메시지를 근거로 이 프로젝트에 대해 질문합니다.",
  },
  {
    n: "03",
    title: "부채 탕감",
    body: "설명하지 못한 영역을 학습하고 다시 검증합니다.",
  },
];

export default function Home() {
  return (
    <main className="wrap">
      <p className="kicker">CRDD · Code Recognition Debt Deductor</p>
      <h1>
        AI가 짠 코드,
        <br />
        당신은 설명할 수 있나요?
      </h1>
      <p className="lede">
        레포를 연결하면 구조를 그래프로 그리고, 프로젝트 자체를 근거로 질문합니다. 설명하지
        못한 영역이 당신의 인지부채입니다.
      </p>

      <AnalyzeForm />

      <div className="stats" style={{ marginTop: 32 }}>
        {STEPS.map((step) => (
          <div className="stat" key={step.n} style={{ flex: "1 1 220px" }}>
            <span style={{ color: "var(--accent)" }}>{step.n}</span>
            <b style={{ fontSize: 14, marginTop: 4 }}>{step.title}</b>
            <p style={{ fontSize: 12, color: "var(--dim)", marginTop: 4, lineHeight: 1.5 }}>
              {step.body}
            </p>
          </div>
        ))}
      </div>

      <p style={{ marginTop: 28 }}>
        <Link className="btn" href="/demo">
          porklog 데모 보기 →
        </Link>
      </p>
    </main>
  );
}
