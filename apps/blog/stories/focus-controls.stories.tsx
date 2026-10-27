import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useTranslations } from 'next-intl';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@mumak/ui/components/accordion';
import { Badge } from '@mumak/ui/components/badge';
import { Button } from '@mumak/ui/components/button';
import { Checkbox } from '@mumak/ui/components/checkbox';
import { Combobox, ComboboxChips, ComboboxChipsInput } from '@mumak/ui/components/combobox';
import { Command, CommandInput, CommandItem, CommandList } from '@mumak/ui/components/command';
import { Input } from '@mumak/ui/components/input';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@mumak/ui/components/input-group';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@mumak/ui/components/input-otp';
import { Label } from '@mumak/ui/components/label';
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarTrigger } from '@mumak/ui/components/menubar';
import { NativeSelect, NativeSelectOption } from '@mumak/ui/components/native-select';
import { RadioGroup, RadioGroupItem } from '@mumak/ui/components/radio-group';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@mumak/ui/components/select';
import { Switch } from '@mumak/ui/components/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@mumak/ui/components/tabs';
import { Textarea } from '@mumak/ui/components/textarea';
import { Toggle } from '@mumak/ui/components/toggle';

import { LabPage } from './lab-page';

function FocusControls() {
  const t = useTranslations('focusControlsLab');
  return (
    <LabPage title={t('title')} description={t('intro')}>
      <section aria-label={t('controls')} className="flex flex-col gap-8 rounded-xl border p-6">
        <Button variant="outline">Button</Button>
        <div className="flex flex-col gap-2">
          <Label htmlFor="focus-input">Input</Label>
          <Input id="focus-input" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="focus-invalid">Input · {t('invalid')}</Label>
          <Input id="focus-invalid" aria-invalid="true" aria-describedby="focus-error" />
          <p id="focus-error" className="text-sm">
            {t('error')}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="focus-disabled">Input · {t('disabled')}</Label>
          <Input id="focus-disabled" disabled />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="focus-textarea">Textarea</Label>
          <Textarea id="focus-textarea" />
        </div>
        <div className="flex items-center gap-3">
          <Checkbox id="focus-checkbox" />
          <Label htmlFor="focus-checkbox">Checkbox</Label>
        </div>
        <div className="flex items-center gap-3">
          <Switch id="focus-switch" />
          <Label htmlFor="focus-switch">Switch</Label>
        </div>
        <Toggle aria-label="Toggle">Toggle</Toggle>
        <RadioGroup defaultValue="one" aria-label="RadioGroup" className="gap-4">
          <div className="flex items-center gap-3">
            <RadioGroupItem id="focus-radio-one" value="one" />
            <Label htmlFor="focus-radio-one">Radio 1</Label>
          </div>
          <div className="flex items-center gap-3">
            <RadioGroupItem id="focus-radio-two" value="two" />
            <Label htmlFor="focus-radio-two">Radio 2</Label>
          </div>
        </RadioGroup>
        <Tabs defaultValue="one">
          <TabsList aria-label="Tabs">
            <TabsTrigger value="one">Tab 1</TabsTrigger>
            <TabsTrigger value="two">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="one">{t('panel', { number: 1 })}</TabsContent>
          <TabsContent value="two">{t('panel', { number: 2 })}</TabsContent>
        </Tabs>
        <Select defaultValue="one">
          <SelectTrigger aria-label="Select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="one">Option 1</SelectItem>
              <SelectItem value="two">Option 2</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <NativeSelect aria-label="NativeSelect">
          <NativeSelectOption value="one">Option 1</NativeSelectOption>
          <NativeSelectOption value="two">Option 2</NativeSelectOption>
        </NativeSelect>
        <Accordion type="single" collapsible>
          <AccordionItem value="one">
            <AccordionTrigger>Accordion</AccordionTrigger>
            <AccordionContent>{t('panel', { number: 1 })}</AccordionContent>
          </AccordionItem>
        </Accordion>
        <Badge asChild variant="outline">
          <a href="#focus-composites">Badge link</a>
        </Badge>
        <Menubar aria-label="Menubar">
          <MenubarMenu>
            <MenubarTrigger>Menu</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>Menu action</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      </section>
      <section id="focus-composites" aria-label={t('composites')} className="flex flex-col gap-8 rounded-xl border p-6">
        <p>{t('compositeHint')}</p>
        <InputGroup>
          <InputGroupInput aria-label="InputGroup" />
          <InputGroupAddon align="inline-end">
            <InputGroupButton aria-label="InputGroup action">Action</InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <Combobox multiple items={[]}>
          <ComboboxChips>
            <ComboboxChipsInput aria-label="Combobox chips" />
          </ComboboxChips>
        </Combobox>
        <Command>
          <CommandInput aria-label="Command search" />
          <CommandList>
            <CommandItem>Command action</CommandItem>
          </CommandList>
        </Command>
        <InputOTP maxLength={4} aria-label="OTP">
          <InputOTPGroup>
            {[0, 1, 2, 3].map(index => (
              <InputOTPSlot key={index} index={index} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </section>
    </LabPage>
  );
}

const meta = { title: 'Components/Focus contract', component: FocusControls } satisfies Meta<typeof FocusControls>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Controls: Story = {};
