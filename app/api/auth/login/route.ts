import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { hashPassword, verifyPassword, isLegacyHash, verifyLegacyPassword, createSession, COOKIE_NAME } from '@/app/lib/auth';

export async function POST(req: Request) {
  try {
    const { manager, password } = await req.json();

    if (!manager || !password) {
      return NextResponse.json({ error: '담당자명과 비밀번호를 입력해주세요.' }, { status: 400 });
    }

    // 사용자 조회
    const { data: user } = await supabase
      .from('sales_users')
      .select('manager, password_hash, role')
      .eq('manager', manager)
      .maybeSingle();

    if (!user) {
      return NextResponse.json({ error: '등록되지 않은 담당자입니다.' }, { status: 401 });
    }

    // 비밀번호 확인 (레거시 SHA-256 해시 자동 마이그레이션)
    let passwordValid = false;
    if (isLegacyHash(user.password_hash)) {
      passwordValid = verifyLegacyPassword(password, user.password_hash);
      if (passwordValid) {
        // 로그인 성공 시 bcrypt로 자동 업그레이드
        const newHash = await hashPassword(password);
        await supabase
          .from('sales_users')
          .update({ password_hash: newHash, updated_at: new Date().toISOString() })
          .eq('manager', manager);
      }
    } else {
      passwordValid = await verifyPassword(password, user.password_hash);
    }

    if (!passwordValid) {
      return NextResponse.json({ error: '비밀번호가 틀렸습니다.' }, { status: 401 });
    }

    // admin 계정은 sales 페이지 로그인 차단 (admin 페이지에서만 사용)
    if (user.role === 'admin') {
      return NextResponse.json({ error: '관리자 계정은 영업 페이지에 접근할 수 없습니다.' }, { status: 403 });
    }

    // 세션 생성
    const token = await createSession(user.manager, user.role);

    const response = NextResponse.json({
      success: true,
      manager: user.manager,
      role: user.role,
    });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30일
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: '로그인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// ── DELETE: 로그아웃 ──
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
