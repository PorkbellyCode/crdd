import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 컨테이너 하나에 Node와 Python(graphify)을 같이 올린다 (Dockerfile 참고).
  // standalone 출력이라야 이미지에 node_modules 전체를 넣지 않는다.
  output: "standalone",
};

export default nextConfig;
