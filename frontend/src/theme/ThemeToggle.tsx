import { Switch, Tooltip } from 'antd';
import { MoonOutlined, SunOutlined } from '@ant-design/icons';
import { useThemeMode } from './ThemeProvider';

export default function ThemeToggle() {
  const { mode, toggle } = useThemeMode();

  return (
    <Tooltip title={`${mode === 'dark' ? 'Dark' : 'Light'} mode`}>
      <Switch
        checkedChildren={<MoonOutlined />}
        unCheckedChildren={<SunOutlined />}
        checked={mode === 'dark'}
        onChange={toggle}
      />
    </Tooltip>
  );
}
