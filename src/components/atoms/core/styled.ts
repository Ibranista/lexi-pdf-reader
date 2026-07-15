import type { ComponentType } from 'react';
import type {
  PressableProps,
  TextInputProps,
  TextProps,
  ViewProps,
} from 'react-native';

import styledBase from 'styled-components/native';

type Interpolation<Props> =
  | ((props: Props) => number | string | undefined)
  | number
  | string;

type StyledFactory = {
  Pressable: StyledTag<PressableProps>;
  Text: StyledTag<TextProps>;
  TextInput: StyledTag<TextInputProps>;
  View: StyledTag<ViewProps>;
};

type StyledTag<BaseProps> = <ExtraProps = {}>(
  strings: TemplateStringsArray,
  ...expr: Interpolation<BaseProps & ExtraProps>[]
) => ComponentType<BaseProps & ExtraProps>;

const styled = styledBase as unknown as StyledFactory;

export default styled;
