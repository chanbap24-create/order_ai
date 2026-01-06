"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* 헤더 */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-800 mb-4">
            📦 발주 관리 시스템
          </h1>
          <p className="text-xl text-gray-600">
            발주할 품목을 선택해주세요
          </p>
        </div>

        {/* 선택 카드 */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* 와인 카드 */}
          <button
            onClick={() => router.push("/wine")}
            className="group relative bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border-2 border-transparent hover:border-purple-400 p-8 text-left"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-100 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-300"></div>
            
            <div className="relative z-10">
              <div className="text-6xl mb-4">🍷</div>
              <h2 className="text-3xl font-bold text-gray-800 mb-3">
                와인 발주
              </h2>
              <p className="text-gray-600 text-lg mb-4">
                와인 제품 발주를 진행합니다
              </p>
              <div className="flex items-center text-purple-600 font-semibold">
                <span>발주하기</span>
                <svg className="w-5 h-5 ml-2 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>

            <div className="absolute bottom-4 right-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <div className="text-8xl">🍾</div>
            </div>
          </button>

          {/* 와인잔 카드 */}
          <button
            onClick={() => router.push("/glass")}
            className="group relative bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border-2 border-transparent hover:border-blue-400 p-8 text-left"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-300"></div>
            
            <div className="relative z-10">
              <div className="text-6xl mb-4">🥂</div>
              <h2 className="text-3xl font-bold text-gray-800 mb-3">
                와인잔 발주
              </h2>
              <p className="text-gray-600 text-lg mb-4">
                대유라이프 와인잔 발주를 진행합니다
              </p>
              <div className="flex items-center text-blue-600 font-semibold">
                <span>발주하기</span>
                <svg className="w-5 h-5 ml-2 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>

            <div className="absolute bottom-4 right-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <div className="text-8xl">✨</div>
            </div>
          </button>
        </div>

        {/* 푸터 */}
        <div className="text-center mt-12 text-gray-500 text-sm">
          <p>Order AI - 스마트 발주 관리 시스템</p>
        </div>
      </div>
    </div>
  );
}
