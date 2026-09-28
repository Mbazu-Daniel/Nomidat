export function ContactFields() {
  return (
    <>
      <label>
        Full name
        <input name="name" required maxLength={160} autoFocus />
      </label>
      <label>
        Contact type
        <select name="kind">
          <option value="customer">Customer</option>
          <option value="lead">Lead</option>
        </select>
      </label>
      <label>
        <span className="workspace-field-heading">
          Phone <small>Optional</small>
        </span>
        <input name="phone" type="tel" maxLength={40} />
      </label>
      <label>
        <span className="workspace-field-heading">
          Email <small>Optional</small>
        </span>
        <input name="email" type="email" />
      </label>
    </>
  );
}
