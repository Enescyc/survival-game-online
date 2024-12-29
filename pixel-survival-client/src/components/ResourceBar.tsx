interface ResourceBarProps {
  label: string;
  value: number;
  color: string;
}

const ResourceBar = ({ label, value, color }: ResourceBarProps) => {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="w-full h-4 bg-gray-200 rounded">
        <div
          className={`h-full rounded ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
};

export default ResourceBar; 