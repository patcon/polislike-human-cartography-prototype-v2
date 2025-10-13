import type { Meta, StoryObj } from '@storybook/react';
import { GroupTabsTrigger, type GroupTabsStyle } from './GroupTabsTrigger';
import { Tabs, TabsList, TabsContent } from '@/components/ui/tabs';
import { PALETTE_COLORS } from '@/constants';

const meta: Meta<typeof GroupTabsTrigger> = {
  title: 'Components/GroupTabsTrigger',
  component: GroupTabsTrigger,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const TabsDemo = ({ tabStyle }: { tabStyle: GroupTabsStyle }) => (
  <div className="w-96 p-4">
    <h3 className="mb-4 text-lg font-semibold capitalize">{tabStyle.replace('-', ' ')} Style</h3>
    <Tabs defaultValue="group-0" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <GroupTabsTrigger
          value="group-0"
          tabStyle={tabStyle}
          color={PALETTE_COLORS[0]}
        >
          A
        </GroupTabsTrigger>
        <GroupTabsTrigger
          value="group-1"
          tabStyle={tabStyle}
          color={PALETTE_COLORS[1]}
        >
          B
        </GroupTabsTrigger>
        <GroupTabsTrigger
          value="group-2"
          tabStyle={tabStyle}
          color={PALETTE_COLORS[2]}
        >
          C
        </GroupTabsTrigger>
        <GroupTabsTrigger
          value="unpainted"
          tabStyle={tabStyle}
          color="black"
        >
          <span className="sm:hidden">X</span>
          <span className="hidden sm:inline">Rest</span>
        </GroupTabsTrigger>
      </TabsList>
      <TabsContent value="group-0" className="mt-4 p-4 border rounded">
        Group A content
      </TabsContent>
      <TabsContent value="group-1" className="mt-4 p-4 border rounded">
        Group B content
      </TabsContent>
      <TabsContent value="group-2" className="mt-4 p-4 border rounded">
        Group C content
      </TabsContent>
      <TabsContent value="unpainted" className="mt-4 p-4 border rounded">
        Rest group content
      </TabsContent>
    </Tabs>
  </div>
);

export const Underline: Story = {
  render: () => <TabsDemo tabStyle="underline" />,
};

export const SmallDot: Story = {
  render: () => <TabsDemo tabStyle="small-dot" />,
};

export const BigDot: Story = {
  render: () => <TabsDemo tabStyle="big-dot" />,
};

export const Enclosure: Story = {
  render: () => <TabsDemo tabStyle="enclosure" />,
};

export const AllVariants: Story = {
  render: () => (
    <div className="space-y-8 p-4">
      <TabsDemo tabStyle="underline" />
      <TabsDemo tabStyle="small-dot" />
      <TabsDemo tabStyle="big-dot" />
      <TabsDemo tabStyle="enclosure" />
    </div>
  ),
};