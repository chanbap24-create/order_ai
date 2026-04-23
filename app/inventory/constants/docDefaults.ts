import type { DocSettings } from "../types";

/** CDV (까브드뱅) 문서 기본값 */
export const CDV_DOC_DEFAULTS: DocSettings = {
  companyName: "(주) 까 브 드 뱅",
  address: "서울특별시 영등포구 여의나루로 71, 809호 / TEL: 02-780-9441 / FAX: 02-780-9444",
  addressEn:
    "Donghwa Bldg., SUITE 809, 71 Yeouinaru-RO, Yeongdeungpo-GU, SEOUL, 07327, KOREA",
  websiteUrl: "www.cavedevin.com",
  sender: "(주)까브드뱅",
  title: "와인 제안의 건",
  content1: "1. 귀사의 일익 번창하심을 기원합니다.",
  content2: "2. 아래와 같이 와인 견적을 보내드리오니 검토하여 주시기 바랍니다.",
  content3: "- 아         래 -",
  unit: "단위 : VAT별도, WON, BTL.",
  representative: "대표이사 유병우",
  sealText: "-직인생략-",
};

/** DL (대유라이프) 문서 기본값 */
export const DL_DOC_DEFAULTS: DocSettings = {
  companyName: "대유라이프 주식회사",
  address: "서울특별시 영등포구 여의나루로 71, 809호 / TEL: 02-780-9441 / FAX: 02-780-9444",
  addressEn:
    "Donghwa Bldg., SUITE 809, 71 Yeouinaru-RO, Yeongdeungpo-GU, SEOUL, 07327, KOREA",
  websiteUrl: "https://www.instagram.com/riedelpartner_korea/",
  sender: "대유라이프 주식회사",
  title: "리델글라스 견적의 건",
  content1: "1. 귀사의 일익 번창하심을 기원합니다.",
  content2: "2. 아래와 같이 리델글라스 견적을 보내드리오니 검토하여 주시기 바랍니다.",
  content3: "- 아         래 -",
  unit: "단위 : 원, ea, %, VAT별도",
  representative: "대표이사  유 병 우",
  sealText: "-직인 생략-",
};

/** 테이스팅 노트 PDF 호스팅 URL */
export const TASTING_NOTE_BASE_URL =
  "https://github.com/chanbap24-create/order_ai/releases/download/note";
