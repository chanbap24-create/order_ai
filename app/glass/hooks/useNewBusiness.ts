import { useState } from "react";

/**
 * 신규 사업자 폼 상태.
 * 체크박스 해제 시 자동으로 입력값을 초기화한다.
 */
export function useNewBusiness() {
  const [enabled, setEnabled] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(""); // 세금계산서 이메일

  const toggle = (next: boolean) => {
    setEnabled(next);
    if (!next) {
      setName("");
      setPhone("");
      setEmail("");
    }
  };

  const payload = () =>
    enabled
      ? {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
        }
      : undefined;

  const isValid = () => !enabled || (!!name.trim() && !!phone.trim());

  return {
    enabled,
    name,
    phone,
    email,
    setEnabled: toggle,
    setName,
    setPhone,
    setEmail,
    payload,
    isValid,
  };
}
