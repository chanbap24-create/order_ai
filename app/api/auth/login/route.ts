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
      .select('manager, password_hash, role, department, failed_attempts, locked_until')
      .eq('manager', manager)
      .maybeSingle();

    if (!user) {
      return NextResponse.json({ error: '등록되지 않은 담당자입니다.' }, { status: 401 });
    }

    // 잠금 확인 (5회 실패 → 5분 잠금)
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remainMs = new Date(user.locked_until).getTime() - Date.now();
      const remainMin = Math.ceil(remainMs / 60000);
      return NextResponse.json({ error: `로그인이 잠금되었습니다. ${remainMin}분 후 다시 시도해주세요.` }, { status: 429 });
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
      const attempts = (user.failed_attempts || 0) + 1;
      const update: Record<string, any> = { failed_attempts: attempts };
      if (attempts >= 5) {
        update.locked_until = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      }
      await supabase.from('sales_users').update(update).eq('manager', manager);
      const remaining = 5 - attempts;
      const msg = remaining > 0
        ? `비밀번호가 틀렸습니다. (${attempts}/5회 실패)`
        : '5회 실패하여 5분간 잠금됩니다.';
      return NextResponse.json({ error: msg }, { status: 401 });
    }

    // admin 계정은 sales 페이지 로그인 차단 (admin 페이지에서만 사용)
    // executive(회장/대표)는 허용
    if (user.role === 'admin') {
      return NextResponse.json({ error: '관리자 계정은 영업 페이지에 접근할 수 없습니다.' }, { status: 403 });
    }

    // 로그인 성공 → 실패 카운터 초기화
    if (user.failed_attempts > 0 || user.locked_until) {
      await supabase.from('sales_users').update({ failed_attempts: 0, locked_until: null }).eq('manager', manager);
    }

    // 세션 생성
    const token = await createSession(user.manager, user.role, user.department || '');

    const response = NextResponse.json({
      success: true,
      manager: user.manager,
      role: user.role,
      department: user.department || '',
    });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7일
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
