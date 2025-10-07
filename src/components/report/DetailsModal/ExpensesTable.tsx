import type { ExpenseRow } from "@/types/repair";
import { toDateTime, fmt } from "@/utils/datetime";

export default function ExpensesTable({ rows }: { rows: ExpenseRow[] }) {
  return (
    <section>
      <h3 className="font-semibold text-lg mb-3">3. รายการค่าใช้จ่ายอื่นๆ</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm table-auto">
          <thead>
            <tr className="bg-gray-100 text-gray-700 ">
              {["ลำดับ","รายการ","จำนวน","หน่วย","ไอดีรายการ","วันเวลาที่บันทึก"].map((h) => (
                <th key={h} className="px-3 py-2 text-center whitespace-nowrap ">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-400">
                  ไม่มีข้อมูล
                </td>
              </tr>
            ) : (
              rows.map((r, i) => {
                const dt = toDateTime(r.createdAt);
                return (
                  <tr key={r.id} className="border-b border-gray-300 text-center">
                    <td className="px-3 py-2 whitespace-nowrap">{i + 1}</td>
                    <td
                      className="px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-[360px] text-left"
                      title={fmt(r.name)}
                    >
                      {fmt(r.name)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.qty ?? "-"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmt(r.unit)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmt(r.id)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{dt.date} {dt.time}</td>
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
