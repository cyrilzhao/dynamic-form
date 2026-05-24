const JsonView: React.FC<{ data: any; title?: string }> = ({ data, title }) => {
  return (
    <div style={{ marginBottom: 16 }}>
      {title && (
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, color: '#374151' }}>
          {title}
        </div>
      )}
      <div
        style={{
          background: '#f3f4f6',
          padding: 12,
          borderRadius: 6,
          fontSize: 12,
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          overflowX: 'auto',
          maxHeight: 200,
          overflowY: 'auto',
          color: '#1f2937',
        }}
      >
        {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
      </div>
    </div>
  );
};

export default JsonView;
