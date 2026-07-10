import { Badge } from '@mumak/ui/components/badge';

import { Link } from '@/src/shared/config/i18n';

interface PostTagsProps {
  tags: string[];
  linkable?: boolean;
  basePath?: string;
}

// 태그 칩은 실제 <Link> anchor로 렌더한다. 이전엔 <span> Badge + onClick이라
// 키보드·스크린리더로 도달/활성화가 불가능했다(마우스 전용). anchor로 두면
// Tab 포커스·Enter 활성화가 되고, 카드 안에서는 relative z-10으로 stretched
// title-link 오버레이 위에 올라가 태그만 독립적으로 클릭된다.
export function PostTags({ tags, linkable = true, basePath = '/blog/tags' }: PostTagsProps) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {tags.map(tag =>
        linkable ? (
          <Link key={tag} href={`${basePath}/${encodeURIComponent(tag)}`} className="relative z-10 rounded-4xl">
            <Badge
              variant="outline"
              className="cursor-pointer text-xs transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              #{tag}
            </Badge>
          </Link>
        ) : (
          <Badge key={tag} variant="outline" className="text-xs">
            #{tag}
          </Badge>
        )
      )}
    </div>
  );
}
