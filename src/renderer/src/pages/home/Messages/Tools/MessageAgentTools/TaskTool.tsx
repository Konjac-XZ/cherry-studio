import { AccordionItem } from '@heroui/react'
import { Bot } from 'lucide-react'
import Markdown from 'react-markdown'

import { ToolTitle } from './GenericTools'
import type { TaskToolInput as TaskToolInputType, TaskToolOutput as TaskToolOutputType } from './types'

export function TaskTool({ input, output }: { input: TaskToolInputType; output?: TaskToolOutputType }) {
  return (
    <AccordionItem
      key="tool"
      aria-label="Task Tool"
      title={<ToolTitle icon={<Bot className="h-4 w-4" />} label="Task" params={input.description} />}>
      {output?.map((item) => (
        <div key={item.type}>
          <div>{item.type === 'text' ? <Markdown>{item.text}</Markdown> : item.text}</div>
        </div>
      ))}
    </AccordionItem>
  )
}
