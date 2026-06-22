import type { Trade, UnitCode, WorkItem } from "./types";

export const unitLabels: Record<UnitCode, string> = {
  sqm: "㎡",
  m: "m",
  piece: "個",
  machine: "台",
  place: "箇所",
  set: "式",
  labor: "人工"
};

export const trades: Trade[] = [
  { id: "trade-cross", name: "クロス工事" },
  { id: "trade-carpenter", name: "大工工事" },
  { id: "trade-electric", name: "電気工事" },
  { id: "trade-paint", name: "塗装工事" },
  { id: "trade-equipment", name: "設備工事" },
  { id: "trade-exterior", name: "外構工事" },
  { id: "trade-demolition", name: "解体工事" }
];

const standardUnitByTrade: Record<string, UnitCode> = {
  "trade-cross": "sqm",
  "trade-carpenter": "place",
  "trade-electric": "place",
  "trade-paint": "sqm",
  "trade-equipment": "place",
  "trade-exterior": "place",
  "trade-demolition": "set"
};

const namesByTrade: Record<string, string[]> = {
  "trade-cross": [
    "クロス貼替",
    "アクセントクロス",
    "天井クロス",
    "壁クロス",
    "クロス部分補修",
    "パテ処理",
    "下地調整",
    "剥がし処分",
    "クッションフロア",
    "CF貼替",
    "ソフト巾木",
    "フロアタイル",
    "長尺シート",
    "タイルカーペット"
  ],
  "trade-carpenter": [
    "巾木交換",
    "廻り縁交換",
    "木枠補修",
    "建具調整",
    "ドア交換",
    "ドアノブ交換",
    "クローゼット補修",
    "床補修",
    "フローリング張替",
    "フローリング増張",
    "ベニヤ張り",
    "ボード張替",
    "石膏ボード補修",
    "棚造作",
    "カウンター造作"
  ],
  "trade-electric": [
    "コンセント交換",
    "コンセント増設",
    "スイッチ交換",
    "スイッチ増設",
    "照明交換",
    "ダウンライト設置",
    "シーリング設置",
    "換気扇交換",
    "インターホン交換",
    "分電盤交換",
    "配線工事",
    "LAN配線",
    "エアコン電源工事"
  ],
  "trade-paint": [
    "外壁塗装",
    "天井塗装",
    "壁塗装",
    "木部塗装",
    "鉄部塗装",
    "軒天塗装",
    "雨戸塗装",
    "シャッター塗装",
    "防水塗装",
    "下塗り",
    "中塗り",
    "上塗り"
  ],
  "trade-equipment": [
    "トイレ交換",
    "便座交換",
    "洗面台交換",
    "水栓交換",
    "キッチン交換",
    "レンジフード交換",
    "給湯器交換",
    "浴室水栓交換",
    "シャワー交換",
    "排水補修"
  ],
  "trade-exterior": [
    "ブロック積み",
    "フェンス設置",
    "門扉交換",
    "土間コンクリート",
    "駐車場造成",
    "カーポート設置",
    "砂利敷き",
    "人工芝",
    "ウッドデッキ",
    "物置設置"
  ],
  "trade-demolition": [
    "内装解体",
    "間仕切解体",
    "キッチン解体",
    "浴室解体",
    "トイレ解体",
    "産廃処分",
    "残材撤去"
  ]
};

function toWorkItem(tradeId: string, name: string, index: number): WorkItem {
  return {
    id: `${tradeId.replace("trade-", "")}-${index + 1}`,
    tradeId,
    name,
    unit: standardUnitByTrade[tradeId],
    standardPrice: 0,
    materialCost: 0,
    laborCost: 0
  };
}

export const workItems: WorkItem[] = Object.entries(namesByTrade).flatMap(([tradeId, names]) =>
  names.map((name, index) => toWorkItem(tradeId, name, index))
);
