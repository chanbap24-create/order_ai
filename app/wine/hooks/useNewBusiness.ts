import { useState } from "react";

/** 신규 사업자 폼 상태 (wine) — 해제 시 입력값 초기화 */
export function useNewBusiness() {
  const [enabled, setEnabled] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const toggle = (next: boolean) => {
    setEnabled(next);
    if (!next) {
      setName("");
      setPhone("");
      setEmail("");
    }
  };

  return {
    enabled,
    name,
    phone,
    email,
    setEnabled: toggle,
    setName,
    setPhone,
    setEmail,
  };
}
