export function ChangeTable({ changes, empty }) {
  if (!changes?.length) return <p>{empty}</p>;
  return (
    <table className="conflict-table">
      <thead>
        <tr>
          <th>Field</th>
          <th>Where</th>
          <th>On the website now</th>
          <th>After confirm</th>
        </tr>
      </thead>
      <tbody>
        {changes.map((row, index) => (
          <tr key={`${row.language}-${row.label}-${index}`}>
            <td>{row.label}</td>
            <td>{row.language}</td>
            <td>{row.current}</td>
            <td>{row.restored}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
