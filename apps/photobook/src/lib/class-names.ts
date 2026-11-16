/** className 조각을 공백으로 잇는다. false·null·undefined·빈 문자열은 뺀다. */
export function joinClassNames(...names: ReadonlyArray<string | false | null | undefined>): string {
  return names.filter((name): name is string => typeof name === 'string' && name.length > 0).join(' ');
}
