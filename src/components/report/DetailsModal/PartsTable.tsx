import type { PartRow } from "@/types/repair";
import { toDateTime, fmt } from "@/utils/datetime";

export default function PartsTable({ rows }: { rows: PartRow[] }) {
  return (
    <section className="mb-4">
      <h3 className="font-semibold text-lg mb-3">2. รายการเบิกอะไหล่</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm table-auto">
          <thead>
            <tr className="bg-gray-100 text-gray-700">
              {[
                "ลำดับ",
                "ชื่ออะไหล่",
                "จำนวน",
                "หน่วย",
                "ไอดีรายการ",
                "วันเวลาที่บันทึก",
                "ไอดีอะไหล่",
                "รหัสอะไหล่",
                "ไอดีล็อต",
              ].map((h) => (
                <th key={h} className="px-6 py-2 text-left whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-6 text-center text-gray-400 whitespace-nowrap"
                >
                  ไม่มีข้อมูล
                </td>
              </tr>
            ) : (
              rows.map((r, i) => {
                const dt = toDateTime(r.createdAt);
                return (
                  <tr key={r.id} className="border-b border-gray-300">
                    <td className="px-3 py-2 whitespace-nowrap text-center">{i + 1}</td>      
                                        <td
                      className="px-3 py-2 whitespace-nowrap max-w-[20rem] truncate"
                      title={fmt(r.partName) || ""}
                    >
                      {fmt(r.partName)}
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      {r.qty ?? "-"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-center">
                      {fmt(r.unit)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-center">{fmt(r.id)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {dt.date} {dt.time}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-center">
                      {fmt(r.partId)}
                    </td>
                    <td
                      className="px-3 py-2 whitespace-nowrap max-w-[12rem] truncate text-center"
                      title={fmt(r.partCode) || " "}
                    >
                      {fmt(r.partCode)}
                    </td>

                    <td className="px-3 py-2 whitespace-nowrap text-center">
                      {fmt(r.lotId)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
