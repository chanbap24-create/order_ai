"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* 헤더 */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            발주 관리 시스템
          </h1>
        </div>

        {/* 선택 카드 */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* 와인 카드 */}
          <button
            onClick={() => router.push("/wine")}
            className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 text-center border-2 border-transparent hover:border-purple-400"
          >
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              와인 발주
            </h2>
            <div className="text-purple-600 font-semibold mt-4">
              발주하기 →
            </div>
          </button>

          {/* 와인잔 카드 */}
          <button
            onClick={() => router.push("/glass")}
            className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 text-center border-2 border-transparent hover:border-blue-400"
          >
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              와인잔 발주
            </h2>
            <div className="text-blue-600 font-semibold mt-4">
              발주하기 →
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
