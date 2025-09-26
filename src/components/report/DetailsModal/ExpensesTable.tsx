// src/components/report/DetailsModal/ExpensesTable.tsx
import type { ExpenseRow } from "@/types/repair";
import { toDateTime, fmt } from "@/utils/datetime";

export default function ExpensesTable({ rows }: { rows: ExpenseRow[] }) {
  return (
    <section>
      <h3 className="font-semibold text-lg mb-3">2. รายการค่าใช้จ่ายอื่นๆ</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-gray-700">
              {[
                "ลำดับ",
                "ไอดีรายการ",
                "วันเวลาที่บันทึก",
                "รายการ",
                "จำนวน",
                "หน่วย",
              ].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2 text-left whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-gray-400"
                >
                  ไม่มีข้อมูล
                </td>
              </tr>
            ) : (
              rows.map((r, i) => {
                const dt = toDateTime(r.createdAt);
                return (
                  <tr key={r.id} className="border-b">
                    <td className="px-3 py-2">{i + 1}</td>
                    <td className="px-3 py-2">{fmt(r.id)}</td>
                    <td className="px-3 py-2">
                      {dt.date} {dt.time}
                    </td>
                    <td className="px-3 py-2">{fmt(r.name)}</td>
                    <td className="px-3 py-2 text-right">
                      {r.qty ?? "-"}
                    </td>
                    <td className="px-3 py-2">{fmt(r.unit)}</td>
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
