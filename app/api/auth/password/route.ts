import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { getSession, hashPassword, verifyPassword } from '@/app/lib/auth';

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { current_password, new_password, target_manager } = await req.json();

    if (!new_password || new_password.length < 4) {
      return NextResponse.json({ error: '새 비밀번호는 4자 이상이어야 합니다.' }, { status: 400 });
    }

    // admin은 다른 사용자의 비밀번호도 변경 가능
    const manager = (session.role === 'admin' && target_manager)
      ? target_manager
      : session.manager;

    // 본인 비밀번호 변경 시 현재 비밀번호 확인
    if (manager === session.manager && current_password) {
      const { data: user } = await supabase
        .from('sales_users')
        .select('password_hash')
        .eq('manager', manager)
        .maybeSingle();

      if (user && !verifyPassword(current_password, user.password_hash)) {
        return NextResponse.json({ error: '현재 비밀번호가 틀렸습니다.' }, { status: 400 });
      }
    }

    // admin이 아닌데 다른 사용자 비밀번호 변경 시도
    if (session.role !== 'admin' && manager !== session.manager) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const newHash = hashPassword(new_password);
    const { error } = await supabase
      .from('sales_users')
      .update({ password_hash: newHash, updated_at: new Date().toISOString() })
      .eq('manager', manager);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json(
      { error: '비밀번호 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
